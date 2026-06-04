"""
API de Reportes — Métricas diarias, mensuales, por cliente y por tarea
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func, and_
from typing import Optional, List
from datetime import date, datetime, timedelta
import pytz
import io

from app.core.database import get_db
from app.core.config import settings
from app.api.auth import obtener_usuario_actual, obtener_empresa_id
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


@router.get("/registro-trabajo")
async def registro_trabajo(
    anio:         int           = Query(...),
    mes:          int           = Query(..., ge=1, le=12),
    cliente_ids:  Optional[str] = Query(default=None, description="IDs separados por coma"),
    catalogo_ids: Optional[str] = Query(default=None, description="IDs separados por coma"),
    usuario_actual: Usuario     = Depends(obtener_usuario_actual),
    empresa_id:     str         = Depends(obtener_empresa_id),
    db: AsyncSession             = Depends(get_db)
):
    """
    Retorna todas las tareas ejecutadas en el mes indicado para la empresa
    del usuario autenticado. Opcionalmente filtra por cliente(s) y/o tarea(s)
    del catálogo. Para tareas complejas incluye el detalle de sus etapas.
    """
    filtros = [
        "t.activa = TRUE",
        "EXTRACT(YEAR  FROM t.fecha_planificada) = :anio",
        "EXTRACT(MONTH FROM t.fecha_planificada) = :mes",
    ]
    params: dict = {"anio": anio, "mes": mes}

    if empresa_id:
        filtros.append("t.empresa_id = :eid")
        params["eid"] = empresa_id

    if cliente_ids:
        ids = [i.strip() for i in cliente_ids.split(",") if i.strip()]
        if ids:
            filtros.append("t.cliente_id = ANY(:cids)")
            params["cids"] = ids

    if catalogo_ids:
        ids = [i.strip() for i in catalogo_ids.split(",") if i.strip()]
        if ids:
            filtros.append("t.catalogo_tarea_id = ANY(:ctids)")
            params["ctids"] = ids

    where = " AND ".join(filtros)

    result = await db.execute(text(f"""
        SELECT
            t.id,
            t.fecha_planificada,
            t.fecha_vencimiento,
            t.estado,
            t.prioridad,
            t.tiempo_trabajado_minutos,
            t.fin_real,
            t.es_tarea_compleja,
            t.seguimiento_complejo_id,
            t.catalogo_tarea_id,
            COALESCE(t.fue_vencida, FALSE)
                OR (t.fin_real IS NOT NULL AND t.fecha_vencimiento IS NOT NULL
                    AND t.fin_real::date > t.fecha_vencimiento) AS fue_vencida,
            COALESCE(ct.nombre, t.nombre_personalizado, 'Sin nombre') AS tarea_nombre,
            COALESCE(ct.codigo, '')  AS tarea_codigo,
            u.nombre || ' ' || u.apellido AS operador_nombre,
            c.razon_social  AS cliente_nombre,
            c.id::TEXT      AS cliente_id,
            s.nombre        AS servicio_nombre
        FROM tareas t
        JOIN  usuarios u      ON t.asignado_a_id    = u.id
        LEFT JOIN catalogo_tareas ct ON t.catalogo_tarea_id = ct.id
        LEFT JOIN clientes    c  ON t.cliente_id    = c.id
        LEFT JOIN servicios   s  ON t.servicio_id   = s.id
        WHERE {where}
        ORDER BY c.razon_social NULLS LAST, t.fecha_planificada, ct.nombre NULLS LAST
        LIMIT 1000
    """), params)
    rows = result.fetchall()

    # Etapas para tareas complejas
    ids_complejas = [str(r.id) for r in rows if r.es_tarea_compleja and r.seguimiento_complejo_id]
    etapas_por_tarea: dict = {}
    if ids_complejas:
        ejec_r = await db.execute(text("""
            SELECT
                t.id::TEXT AS tarea_id,
                e.orden,
                e.nombre,
                e.estado,
                e.fin_real,
                e.tiempo_trabajado_minutos,
                e.vencimiento_sla,
                COALESCE(e.sla_vencido, FALSE) AS sla_vencido
            FROM tareas t
            JOIN tarea_compleja_etapas e ON e.ejecucion_id = t.seguimiento_complejo_id
            WHERE t.id = ANY(:ids) AND e.activo = TRUE
            ORDER BY t.id, e.orden
        """), {"ids": ids_complejas})
        for e in ejec_r.fetchall():
            etapas_por_tarea.setdefault(e.tarea_id, []).append({
                "orden":                    e.orden,
                "nombre":                   e.nombre,
                "estado":                   e.estado,
                "fin_real":                 e.fin_real.isoformat() if e.fin_real else None,
                "tiempo_trabajado_minutos": e.tiempo_trabajado_minutos,
                "vencimiento_sla":          e.vencimiento_sla.isoformat() if e.vencimiento_sla else None,
                "sla_vencido":              e.sla_vencido,
            })

    tareas = []
    for r in rows:
        tid = str(r.id)
        etapas = etapas_por_tarea.get(tid, [])
        if r.es_tarea_compleja and etapas:
            tiempo_total = sum(e["tiempo_trabajado_minutos"] or 0 for e in etapas)
            fue_vencida  = r.fue_vencida or any(e["sla_vencido"] for e in etapas)
        else:
            tiempo_total = r.tiempo_trabajado_minutos
            fue_vencida  = bool(r.fue_vencida)

        tareas.append({
            "id":                       tid,
            "tarea_nombre":             r.tarea_nombre,
            "tarea_codigo":             r.tarea_codigo,
            "catalogo_tarea_id":        str(r.catalogo_tarea_id) if r.catalogo_tarea_id else None,
            "cliente_id":               r.cliente_id,
            "cliente_nombre":           r.cliente_nombre or "Sin cliente",
            "servicio_nombre":          r.servicio_nombre,
            "operador_nombre":          r.operador_nombre,
            "fecha_planificada":        r.fecha_planificada.isoformat() if r.fecha_planificada else None,
            "fecha_vencimiento":        r.fecha_vencimiento.isoformat() if r.fecha_vencimiento else None,
            "estado":                   r.estado,
            "prioridad":                r.prioridad,
            "fue_vencida":              fue_vencida,
            "es_tarea_compleja":        bool(r.es_tarea_compleja),
            "tiempo_trabajado_minutos": tiempo_total,
            "etapas":                   etapas,
        })

    return {"anio": anio, "mes": mes, "total": len(tareas), "tareas": tareas}


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
