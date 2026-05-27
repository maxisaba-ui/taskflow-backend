"""
API de Seguimiento Complejo
Gestiona liquidaciones, sindicatos y procedimientos con etapas y fechas límite.
Incluye semáforo de colores y alertas de vencimiento.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel, UUID4
from typing import Optional, List
from datetime import date, datetime, timedelta
import pytz

from app.core.database import get_db
from app.core.config import settings
from app.api.auth import obtener_usuario_actual
from app.models.usuario import Usuario

router = APIRouter()
TZ = pytz.timezone(settings.TIMEZONE)


# ============================================================
# SCHEMAS
# ============================================================

class SeguimientoCrear(BaseModel):
    nombre: str
    cliente_id: UUID4
    servicio_id: UUID4
    responsable_id: UUID4
    periodo: str                        # 'YYYY-MM'
    tipo: str = "hacia_adelante"        # 'hacia_adelante' | 'hacia_atras'
    fecha_vencimiento: Optional[date] = None
    notas: Optional[str] = None


class EtapaCrear(BaseModel):
    orden: int
    nombre: str
    es_obligatoria: bool = True
    tipo_limite: Optional[str] = None
    limite_cantidad: Optional[int] = None


class CompletarEtapaRequest(BaseModel):
    notas: Optional[str] = None


# ============================================================
# ENDPOINTS
# ============================================================

@router.get("/")
async def listar_seguimientos(
    periodo: Optional[str] = Query(default=None, description="Formato: YYYY-MM"),
    cliente_id: Optional[str] = Query(default=None),
    solo_alertas: bool = Query(default=False, description="Solo los que tienen alertas hoy"),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista seguimientos complejos con sus etapas.
    Calcula automáticamente el estado semáforo de cada uno.
    """
    if periodo is None:
        periodo = datetime.now(TZ).strftime("%Y-%m")

    filtros = ["sc.activo = TRUE", "sc.periodo = :periodo"]
    params = {"periodo": periodo}

    if cliente_id:
        filtros.append("sc.cliente_id = :cliente_id")
        params["cliente_id"] = cliente_id

    where_clause = " AND ".join(filtros)

    result = await db.execute(text(f"""
        SELECT
            sc.id,
            sc.nombre,
            sc.periodo,
            sc.tipo,
            sc.estado,
            sc.fecha_vencimiento,
            sc.notas,
            c.razon_social   AS cliente,
            c.id             AS cliente_id,
            s.nombre         AS servicio,
            u.nombre || ' ' || u.apellido AS responsable
        FROM seguimiento_complejo sc
        LEFT JOIN clientes c  ON sc.cliente_id  = c.id
        LEFT JOIN servicios s ON sc.servicio_id  = s.id
        LEFT JOIN usuarios u  ON sc.responsable_id = u.id
        WHERE {where_clause}
        ORDER BY sc.creado_en DESC
    """), params)

    seguimientos = result.fetchall()
    resultado = []

    for seg in seguimientos:
        # Cargar etapas de este seguimiento
        etapas_result = await db.execute(text("""
            SELECT
                se.id, se.orden, se.nombre, se.es_obligatoria,
                se.tipo_limite, se.limite_cantidad,
                se.fecha_limite_calculada, se.estado,
                se.completada_en, se.notas,
                se.es_actualizacion,
                u.nombre || ' ' || u.apellido AS completada_por_nombre
            FROM seguimiento_etapas se
            LEFT JOIN usuarios u ON se.completada_por = u.id
            WHERE se.seguimiento_id = :sid
            ORDER BY se.orden
        """), {"sid": str(seg.id)})

        etapas = etapas_result.fetchall()

        # Calcular estado semáforo global
        hoy = date.today()
        tiene_alerta_hoy = False
        tiene_vencida = False

        etapas_dict = []
        for e in etapas:
            estado_calc = e.estado

            # Recalcular estado basado en fecha límite si está pendiente
            if e.estado == "pendiente" and e.fecha_limite_calculada:
                fecha_lim = e.fecha_limite_calculada
                if hasattr(fecha_lim, "date"):
                    fecha_lim = fecha_lim.date()
                if fecha_lim < hoy:
                    estado_calc = "vencida"
                    tiene_vencida = True
                elif fecha_lim == hoy:
                    estado_calc = "advertencia_hoy"
                    tiene_alerta_hoy = True

            if estado_calc in ("vencida", "completada_tarde"):
                tiene_vencida = True
            if estado_calc == "advertencia_hoy":
                tiene_alerta_hoy = True

            etapas_dict.append({
                "id": str(e.id),
                "orden": e.orden,
                "nombre": e.nombre,
                "es_obligatoria": e.es_obligatoria,
                "tipo_limite": e.tipo_limite,
                "limite_cantidad": e.limite_cantidad,
                "fecha_limite_calculada": e.fecha_limite_calculada.isoformat() if e.fecha_limite_calculada else None,
                "estado": estado_calc,
                "completada_en": e.completada_en.isoformat() if e.completada_en else None,
                "completada_por": e.completada_por_nombre,
                "notas": e.notas,
                "es_actualizacion": e.es_actualizacion,
            })

        if solo_alertas and not (tiene_alerta_hoy or tiene_vencida):
            continue

        resultado.append({
            "id": str(seg.id),
            "nombre": seg.nombre,
            "periodo": seg.periodo,
            "tipo": seg.tipo,
            "estado": seg.estado,
            "fecha_vencimiento": seg.fecha_vencimiento.isoformat() if seg.fecha_vencimiento else None,
            "cliente": seg.cliente,
            "cliente_id": str(seg.cliente_id),
            "servicio": seg.servicio,
            "responsable": seg.responsable,
            "notas": seg.notas,
            "tiene_alerta_hoy": tiene_alerta_hoy,
            "tiene_vencida": tiene_vencida,
            "etapas": etapas_dict,
        })

    return resultado


@router.post("/", status_code=201)
async def crear_seguimiento(
    datos: SeguimientoCrear,
    etapas: List[EtapaCrear],
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Crea un nuevo seguimiento complejo con sus etapas"""
    # Insertar seguimiento
    result = await db.execute(text("""
        INSERT INTO seguimiento_complejo
            (nombre, cliente_id, servicio_id, responsable_id, periodo,
             tipo, estado, fecha_vencimiento, notas, activo, creado_en, creado_por)
        VALUES
            (:nombre, :cliente_id, :servicio_id, :responsable_id, :periodo,
             :tipo, 'pendiente', :fecha_vencimiento, :notas, TRUE, NOW(), :creado_por)
        RETURNING id
    """), {
        "nombre": datos.nombre,
        "cliente_id": str(datos.cliente_id),
        "servicio_id": str(datos.servicio_id),
        "responsable_id": str(datos.responsable_id),
        "periodo": datos.periodo,
        "tipo": datos.tipo,
        "fecha_vencimiento": datos.fecha_vencimiento,
        "notas": datos.notas,
        "creado_por": str(usuario_actual.id),
    })
    seg_id = result.fetchone()[0]

    # Insertar etapas con fechas límite calculadas
    hoy = date.today()
    fecha_ref = hoy

    for etapa in sorted(etapas, key=lambda e: e.orden):
        fecha_limite = None

        if etapa.tipo_limite and etapa.limite_cantidad:
            if datos.tipo == "hacia_adelante":
                # Calcular X días hábiles hacia adelante desde fecha_ref
                fecha_limite = await _calcular_dia_habil_db(
                    db, fecha_ref, etapa.limite_cantidad, 1
                )
                fecha_ref = fecha_limite
            elif datos.tipo == "hacia_atras" and datos.fecha_vencimiento:
                # Calcular X días hábiles hacia atrás desde vencimiento
                fecha_limite = await _calcular_dia_habil_db(
                    db, datos.fecha_vencimiento, etapa.limite_cantidad, -1
                )

        await db.execute(text("""
            INSERT INTO seguimiento_etapas
                (seguimiento_id, orden, nombre, es_obligatoria,
                 tipo_limite, limite_cantidad, fecha_limite_calculada,
                 estado, creado_en)
            VALUES
                (:seg_id, :orden, :nombre, :obligatoria,
                 :tipo_limite, :limite, :fecha_limite,
                 'pendiente', NOW())
        """), {
            "seg_id": str(seg_id),
            "orden": etapa.orden,
            "nombre": etapa.nombre,
            "obligatoria": etapa.es_obligatoria,
            "tipo_limite": etapa.tipo_limite,
            "limite": etapa.limite_cantidad,
            "fecha_limite": datetime.combine(fecha_limite, datetime.min.time()).replace(
                tzinfo=TZ) if fecha_limite else None,
        })

    await db.flush()
    return {"id": str(seg_id), "mensaje": "Seguimiento creado correctamente"}


@router.post("/{seguimiento_id}/etapas/{etapa_id}/completar")
async def completar_etapa(
    seguimiento_id: str,
    etapa_id: str,
    datos: CompletarEtapaRequest,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    Marca una etapa como completada.
    Determina si fue a tiempo o tarde comparando con la fecha límite.
    """
    ahora = datetime.now(TZ)

    # Obtener la etapa
    result = await db.execute(text("""
        SELECT se.*, sc.tipo
        FROM seguimiento_etapas se
        JOIN seguimiento_complejo sc ON se.seguimiento_id = sc.id
        WHERE se.id = :eid AND se.seguimiento_id = :sid
    """), {"eid": etapa_id, "sid": seguimiento_id})

    etapa = result.fetchone()
    if not etapa:
        raise HTTPException(404, "Etapa no encontrada")

    if etapa.estado in ("completada_ok", "completada_tarde"):
        raise HTTPException(400, "Esta etapa ya fue completada")

    # Determinar si fue a tiempo o tarde
    fue_a_tiempo = True
    if etapa.fecha_limite_calculada:
        fue_a_tiempo = ahora <= etapa.fecha_limite_calculada

    nuevo_estado = "completada_ok" if fue_a_tiempo else "completada_tarde"

    await db.execute(text("""
        UPDATE seguimiento_etapas
        SET estado = :estado,
            completada_en = :ahora,
            completada_por = :usuario,
            notas = COALESCE(:notas, notas)
        WHERE id = :eid
    """), {
        "estado": nuevo_estado,
        "ahora": ahora,
        "usuario": str(usuario_actual.id),
        "notas": datos.notas,
        "eid": etapa_id,
    })

    # Verificar si todas las etapas obligatorias están completadas
    result2 = await db.execute(text("""
        SELECT COUNT(*) AS pendientes
        FROM seguimiento_etapas
        WHERE seguimiento_id = :sid
          AND es_obligatoria = TRUE
          AND estado NOT IN ('completada_ok', 'completada_tarde')
    """), {"sid": seguimiento_id})

    pendientes = result2.fetchone().pendientes

    # Si no quedan etapas pendientes, cerrar el seguimiento
    if pendientes == 0:
        hay_faltas = await db.execute(text("""
            SELECT COUNT(*) FROM seguimiento_etapas
            WHERE seguimiento_id = :sid AND estado = 'completada_tarde'
        """), {"sid": seguimiento_id})
        faltas = hay_faltas.scalar()
        estado_final = "con_falta" if faltas > 0 else "completado"

        await db.execute(text("""
            UPDATE seguimiento_complejo
            SET estado = :estado, fecha_fin_real = :ahora, actualizado_en = :ahora
            WHERE id = :sid
        """), {"estado": estado_final, "ahora": ahora, "sid": seguimiento_id})

    await db.flush()

    return {
        "mensaje": f"Etapa completada {'a tiempo ✅' if fue_a_tiempo else 'TARDE ⚠️'}",
        "estado_etapa": nuevo_estado,
        "fue_a_tiempo": fue_a_tiempo,
    }


@router.get("/alertas-hoy")
async def alertas_hoy(
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    Devuelve todas las etapas que vencen hoy o están vencidas.
    Se usa para el panel de alertas en el Dashboard.
    """
    hoy = date.today()
    result = await db.execute(text("""
        SELECT
            sc.id        AS seguimiento_id,
            sc.nombre    AS seguimiento,
            sc.periodo,
            c.razon_social AS cliente,
            se.nombre    AS etapa,
            se.fecha_limite_calculada,
            se.estado,
            u.nombre || ' ' || u.apellido AS responsable
        FROM seguimiento_etapas se
        JOIN seguimiento_complejo sc ON se.seguimiento_id = sc.id
        JOIN clientes c              ON sc.cliente_id = c.id
        JOIN usuarios u              ON sc.responsable_id = u.id
        WHERE se.estado NOT IN ('completada_ok', 'completada_tarde')
          AND sc.activo = TRUE
          AND se.fecha_limite_calculada::DATE <= :hoy
        ORDER BY se.fecha_limite_calculada
    """), {"hoy": hoy})

    alertas = result.fetchall()

    return [
        {
            "seguimiento_id": str(a.seguimiento_id),
            "seguimiento": a.seguimiento,
            "periodo": a.periodo,
            "cliente": a.cliente,
            "etapa": a.etapa,
            "fecha_limite": a.fecha_limite_calculada.isoformat() if a.fecha_limite_calculada else None,
            "estado": "vencida" if a.fecha_limite_calculada and a.fecha_limite_calculada.date() < hoy else "advertencia_hoy",
            "responsable": a.responsable,
        }
        for a in alertas
    ]


async def _calcular_dia_habil_db(db, fecha_inicio: date, dias: int, sentido: int) -> date:
    """Calcula días hábiles usando la tabla de feriados"""
    result = await db.execute(
        text("SELECT calcular_dia_habil(:fecha, :dias, :sentido)"),
        {"fecha": fecha_inicio, "dias": dias, "sentido": sentido}
    )
    return result.scalar()

