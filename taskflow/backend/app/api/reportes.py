"""
API de Reportes — Métricas diarias, mensuales, por cliente y por tarea
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func, and_
from typing import Optional
from datetime import date, datetime, timedelta
import pytz
import io

from app.core.database import get_db
from app.core.config import settings
from app.api.auth import obtener_usuario_actual
from app.models.usuario import Usuario

router = APIRouter()
TZ = pytz.timezone(settings.TIMEZONE)


@router.get("/diario/{usuario_id}")
async def reporte_diario(
    usuario_id: str,
    fecha: Optional[date] = Query(default=None),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    Reporte diario de un operador:
    - Hora de inicio/fin de jornada
    - Horas en tareas vs. sin tareas
    - Brecha más larga sin tareas
    - Listado completo de tareas
    """
    if fecha is None:
        fecha = date.today()
    
    result = await db.execute(text("""
        SELECT
            COUNT(*) AS total_tareas,
            COUNT(*) FILTER (WHERE estado = 'completada') AS completadas,
            COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
            COUNT(*) FILTER (WHERE estado = 'vencida') AS vencidas,
            SUM(tiempo_trabajado_minutos) AS minutos_trabajados,
            MIN(inicio_real) AS primera_tarea,
            MAX(fin_real) AS ultima_tarea
        FROM tareas
        WHERE asignado_a_id = :uid
          AND fecha_planificada = :fecha
          AND activa = TRUE
    """), {"uid": usuario_id, "fecha": fecha})
    
    stats = result.fetchone()
    
    # Obtener configuración de jornada del usuario
    result_usuario = await db.execute(text("""
        SELECT 
            COALESCE(u.horario_inicio, e.horario_inicio_default) AS inicio_jornada,
            COALESCE(u.horario_fin, e.horario_fin_default) AS fin_jornada,
            u.nombre || ' ' || u.apellido AS nombre_completo
        FROM usuarios u
        CROSS JOIN empresas e
        WHERE u.id = :uid
        LIMIT 1
    """), {"uid": usuario_id})
    
    datos_usuario = result_usuario.fetchone()
    
    # Calcular brechas entre tareas
    result_tareas = await db.execute(text("""
        SELECT inicio_real, fin_real, tiempo_trabajado_minutos,
               nombre_personalizado, estado
        FROM tareas
        WHERE asignado_a_id = :uid
          AND fecha_planificada = :fecha
          AND activa = TRUE
          AND inicio_real IS NOT NULL
        ORDER BY inicio_real
    """), {"uid": usuario_id, "fecha": fecha})
    
    tareas = result_tareas.fetchall()
    brecha_max = _calcular_brecha_maxima(tareas)
    
    minutos_trabajados = stats.minutos_trabajados or 0
    horas_jornada = 0
    if datos_usuario and datos_usuario.inicio_jornada and datos_usuario.fin_jornada:
        inicio = datetime.combine(fecha, datos_usuario.inicio_jornada)
        fin = datetime.combine(fecha, datos_usuario.fin_jornada)
        horas_jornada = (fin - inicio).total_seconds() / 60
    
    return {
        "fecha": fecha.isoformat(),
        "usuario_id": usuario_id,
        "nombre_operador": datos_usuario.nombre_completo if datos_usuario else "",
        "jornada_inicio_esperado": str(datos_usuario.inicio_jornada) if datos_usuario else None,
        "jornada_fin_esperado": str(datos_usuario.fin_jornada) if datos_usuario else None,
        "primera_tarea_hora": stats.primera_tarea.isoformat() if stats.primera_tarea else None,
        "ultima_tarea_hora": stats.ultima_tarea.isoformat() if stats.ultima_tarea else None,
        "total_tareas": stats.total_tareas or 0,
        "tareas_completadas": stats.completadas or 0,
        "tareas_pendientes": stats.pendientes or 0,
        "tareas_vencidas": stats.vencidas or 0,
        "minutos_en_tareas": minutos_trabajados,
        "horas_en_tareas": round(minutos_trabajados / 60, 2),
        "minutos_jornada_esperada": horas_jornada,
        "minutos_sin_tareas": max(0, horas_jornada - minutos_trabajados),
        "brecha_maxima_minutos": brecha_max,
    }


@router.get("/mensual/{usuario_id}")
async def reporte_mensual(
    usuario_id: str,
    anio: int = Query(default=None),
    mes: int = Query(default=None, ge=1, le=12),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Reporte mensual de un operador"""
    hoy = date.today()
    if anio is None:
        anio = hoy.year
    if mes is None:
        mes = hoy.month
    
    result = await db.execute(text("""
        SELECT
            fecha_planificada AS fecha,
            COUNT(*) AS total_tareas,
            COUNT(*) FILTER (WHERE estado = 'completada') AS completadas,
            SUM(tiempo_trabajado_minutos) AS minutos_trabajados,
            MIN(inicio_real) AS primera_tarea,
            MAX(fin_real) AS ultima_tarea
        FROM tareas
        WHERE asignado_a_id = :uid
          AND EXTRACT(YEAR FROM fecha_planificada) = :anio
          AND EXTRACT(MONTH FROM fecha_planificada) = :mes
          AND activa = TRUE
        GROUP BY fecha_planificada
        ORDER BY fecha_planificada
    """), {"uid": usuario_id, "anio": anio, "mes": mes})
    
    dias = result.fetchall()
    
    total_minutos = sum(d.minutos_trabajados or 0 for d in dias)
    dias_trabajados = len([d for d in dias if d.minutos_trabajados and d.minutos_trabajados > 0])
    
    primeras_horas = [d.primera_tarea for d in dias if d.primera_tarea]
    ultimas_horas = [d.ultima_tarea for d in dias if d.ultima_tarea]
    
    return {
        "usuario_id": usuario_id,
        "anio": anio,
        "mes": mes,
        "dias_trabajados": dias_trabajados,
        "horas_totales": round(total_minutos / 60, 2),
        "dia_inicio_mas_temprano": min(primeras_horas).isoformat() if primeras_horas else None,
        "dia_inicio_mas_tarde": max(primeras_horas).isoformat() if primeras_horas else None,
        "dia_fin_mas_temprano": min(ultimas_horas).isoformat() if ultimas_horas else None,
        "dia_fin_mas_tarde": max(ultimas_horas).isoformat() if ultimas_horas else None,
        "detalle_dias": [
            {
                "fecha": d.fecha.isoformat(),
                "tareas": d.total_tareas,
                "completadas": d.completadas,
                "horas": round((d.minutos_trabajados or 0) / 60, 2),
                "inicio": d.primera_tarea.isoformat() if d.primera_tarea else None,
                "fin": d.ultima_tarea.isoformat() if d.ultima_tarea else None,
            }
            for d in dias
        ]
    }


@router.get("/por-cliente")
async def reporte_por_cliente(
    anio: int = Query(default=None),
    mes: int = Query(default=None, ge=1, le=12),
    cliente_id: Optional[str] = Query(default=None),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Tiempo dedicado por cliente, desglosado por rubro"""
    hoy = date.today()
    if anio is None:
        anio = hoy.year
    if mes is None:
        mes = hoy.month
    
    filtro_cliente = "AND t.cliente_id = :cid" if cliente_id else ""
    params = {"anio": anio, "mes": mes}
    if cliente_id:
        params["cid"] = cliente_id
    
    result = await db.execute(text(f"""
        SELECT
            c.id AS cliente_id,
            c.razon_social AS cliente,
            rt.nombre AS rubro,
            rt.color_hex AS rubro_color,
            SUM(t.tiempo_trabajado_minutos) AS minutos_totales,
            COUNT(*) AS cantidad_tareas,
            COUNT(DISTINCT t.asignado_a_id) AS operadores
        FROM tareas t
        JOIN clientes c ON t.cliente_id = c.id
        JOIN rubros_tarea rt ON t.rubro_id = rt.id
        WHERE t.estado = 'completada'
          AND t.activa = TRUE
          AND EXTRACT(YEAR FROM t.fecha_planificada) = :anio
          AND EXTRACT(MONTH FROM t.fecha_planificada) = :mes
          {filtro_cliente}
        GROUP BY c.id, c.razon_social, rt.nombre, rt.color_hex
        ORDER BY SUM(t.tiempo_trabajado_minutos) DESC
    """), params)
    
    rows = result.fetchall()
    
    # Agrupar por cliente
    clientes = {}
    for row in rows:
        cid = str(row.cliente_id)
        if cid not in clientes:
            clientes[cid] = {
                "cliente_id": cid,
                "cliente": row.cliente,
                "minutos_totales": 0,
                "horas_totales": 0,
                "rubros": []
            }
        clientes[cid]["minutos_totales"] += row.minutos_totales or 0
        clientes[cid]["rubros"].append({
            "rubro": row.rubro,
            "color": row.rubro_color,
            "minutos": row.minutos_totales or 0,
            "horas": round((row.minutos_totales or 0) / 60, 2),
            "tareas": row.cantidad_tareas,
        })
    
    for c in clientes.values():
        c["horas_totales"] = round(c["minutos_totales"] / 60, 2)
    
    return {
        "anio": anio,
        "mes": mes,
        "clientes": list(clientes.values())
    }


@router.get("/por-rubro")
async def reporte_por_rubro(
    anio: int = Query(default=None),
    mes: int = Query(default=None, ge=1, le=12),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Tiempo dedicado por tipo de tarea (rubro), sin importar el cliente"""
    hoy = date.today()
    if anio is None:
        anio = hoy.year
    if mes is None:
        mes = hoy.month
    
    result = await db.execute(text("""
        SELECT
            rt.nombre AS rubro,
            rt.color_hex AS color,
            SUM(t.tiempo_trabajado_minutos) AS minutos_totales,
            COUNT(*) AS cantidad_tareas,
            COUNT(DISTINCT t.cliente_id) AS clientes_distintos,
            COUNT(DISTINCT t.asignado_a_id) AS operadores_distintos
        FROM tareas t
        JOIN rubros_tarea rt ON t.rubro_id = rt.id
        WHERE t.estado = 'completada'
          AND t.activa = TRUE
          AND EXTRACT(YEAR FROM t.fecha_planificada) = :anio
          AND EXTRACT(MONTH FROM t.fecha_planificada) = :mes
        GROUP BY rt.nombre, rt.color_hex
        ORDER BY SUM(t.tiempo_trabajado_minutos) DESC
    """), {"anio": anio, "mes": mes})
    
    rows = result.fetchall()
    total_minutos = sum(r.minutos_totales or 0 for r in rows)
    
    return {
        "anio": anio,
        "mes": mes,
        "total_horas": round(total_minutos / 60, 2),
        "rubros": [
            {
                "rubro": r.rubro,
                "color": r.color,
                "minutos": r.minutos_totales or 0,
                "horas": round((r.minutos_totales or 0) / 60, 2),
                "porcentaje": round((r.minutos_totales or 0) / total_minutos * 100, 1) if total_minutos > 0 else 0,
                "tareas": r.cantidad_tareas,
                "clientes": r.clientes_distintos,
            }
            for r in rows
        ]
    }


@router.get("/comparativo-operadores")
async def reporte_comparativo(
    anio: int = Query(default=None),
    mes: int = Query(default=None, ge=1, le=12),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Comparativo de rendimiento entre operadores del mes"""
    hoy = date.today()
    if anio is None:
        anio = hoy.year
    if mes is None:
        mes = hoy.month
    
    result = await db.execute(text("""
        SELECT
            u.id AS usuario_id,
            u.nombre || ' ' || u.apellido AS operador,
            COUNT(*) AS total_tareas,
            COUNT(*) FILTER (WHERE t.estado = 'completada') AS completadas,
            COUNT(*) FILTER (WHERE t.estado = 'vencida') AS vencidas,
            SUM(t.tiempo_trabajado_minutos) AS minutos_totales,
            COUNT(DISTINCT t.cliente_id) AS clientes_atendidos
        FROM tareas t
        JOIN usuarios u ON t.asignado_a_id = u.id
        WHERE t.activa = TRUE
          AND EXTRACT(YEAR FROM t.fecha_planificada) = :anio
          AND EXTRACT(MONTH FROM t.fecha_planificada) = :mes
        GROUP BY u.id, u.nombre, u.apellido
        ORDER BY SUM(t.tiempo_trabajado_minutos) DESC
    """), {"anio": anio, "mes": mes})
    
    rows = result.fetchall()
    
    return {
        "anio": anio,
        "mes": mes,
        "operadores": [
            {
                "usuario_id": str(r.usuario_id),
                "operador": r.operador,
                "total_tareas": r.total_tareas,
                "completadas": r.completadas or 0,
                "vencidas": r.vencidas or 0,
                "porcentaje_cumplimiento": round(
                    (r.completadas or 0) / r.total_tareas * 100, 1
                ) if r.total_tareas > 0 else 0,
                "horas_trabajadas": round((r.minutos_totales or 0) / 60, 2),
                "clientes_atendidos": r.clientes_atendidos or 0,
            }
            for r in rows
        ]
    }


def _calcular_brecha_maxima(tareas) -> int:
    """Calcula la brecha más larga entre tareas (en minutos)"""
    if len(tareas) < 2:
        return 0
    
    tareas_con_tiempo = [(t.inicio_real, t.fin_real) for t in tareas 
                          if t.inicio_real and t.fin_real]
    tareas_con_tiempo.sort()
    
    brecha_max = 0
    for i in range(1, len(tareas_con_tiempo)):
        fin_anterior = tareas_con_tiempo[i-1][1]
        inicio_siguiente = tareas_con_tiempo[i][0]
        if inicio_siguiente > fin_anterior:
            brecha = (inicio_siguiente - fin_anterior).total_seconds() / 60
            brecha_max = max(brecha_max, int(brecha))
    
    return brecha_max
