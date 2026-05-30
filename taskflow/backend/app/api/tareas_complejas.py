"""
=============================================================
Archivo: tareas_complejas.py
Versión: v1.0.2
-------------------------------------------------------------
DESCRIPCION FUNCIONAL:
  Endpoints REST para el módulo de tareas complejas con etapas.
  Usa las tablas propias del módulo:
    - tarea_compleja_plantilla_etapas  (plantilla del catálogo)
    - tarea_compleja_ejecucion         (instancia por tarea asignada)
    - tarea_compleja_etapas            (pasos de la instancia)

DESCRIPCION TECNICA:
  Todos los INSERT/UPDATE usan text() (SQL directo) para evitar
  el NoReferencedTableError del ORM de SQLAlchemy.
  Se registra auditoría en cada operación relevante.

REGISTRO EN main.py:
  from app.api import tareas_complejas
  app.include_router(
      tareas_complejas.router,
      prefix="/api/v1/tareas-complejas",
      tags=["tareas-complejas"]
  )
=============================================================
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text as sqlt
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid as uuid_mod
import pytz

from app.core.database import get_db
from app.api.auth import obtener_usuario_actual
from app.models.usuario import Usuario
from app.api.tareas import _obtener_perfiles

router = APIRouter()

# Zona horaria Argentina — timestamps inicio_real/fin_real en hora local
TZ = pytz.timezone('America/Argentina/Buenos_Aires')


# =============================================================================
# MODELOS PYDANTIC
# =============================================================================

class EtapaPlantillaCrear(BaseModel):
    """Esquema para crear/editar un paso en la plantilla de tarea compleja."""
    orden:                          int
    nombre:                         str
    descripcion:                    Optional[str]  = None
    responsable_tipo:               str            = "operador_asignado"
    usuario_especifico_id:          Optional[str]  = None
    requiere_validacion_supervisor: bool           = False
    sla_validacion_horas:           Optional[int]  = None


class AccionEtapaRequest(BaseModel):
    """Datos opcionales para acciones sobre una etapa."""
    comentario: Optional[str] = None
    motivo:     Optional[str] = None


class ReasignarEtapaRequest(BaseModel):
    """Solicitud de reasignación de una etapa a otro usuario."""
    nuevo_asignado_id: str
    motivo:            str


class ValidarEtapaRequest(BaseModel):
    """Aprobación o rechazo de una etapa por el supervisor."""
    aprobada:          bool
    comentario:        Optional[str] = None
    accion_rechazo:    Optional[str] = "corregir"  # "corregir" | "desestimar"
    prioridad_rechazo: Optional[str] = None


# =============================================================================
# PLANTILLAS DE ETAPAS — administración desde el catálogo
# =============================================================================

@router.get("/catalogo/{catalogo_tarea_id}/etapas")
async def listar_etapas_plantilla(
    catalogo_tarea_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Lista los pasos definidos en la plantilla de una tarea compleja.
    DESCRIPCION TECNICA:
      JOIN con usuarios para mostrar el nombre del usuario específico.
    """
    result = await db.execute(sqlt("""
        SELECT
            e.id, e.orden, e.nombre, e.descripcion,
            e.responsable_tipo, e.usuario_especifico_id,
            e.requiere_validacion_supervisor, e.sla_validacion_horas,
            u.nombre || ' ' || u.apellido AS usuario_especifico_nombre
        FROM tarea_compleja_plantilla_etapas e
        LEFT JOIN usuarios u ON e.usuario_especifico_id = u.id
        WHERE e.catalogo_tarea_id = :ctid AND e.activo = TRUE
        ORDER BY e.orden
    """), {"ctid": catalogo_tarea_id})

    return [
        {
            "id":                             str(r.id),
            "orden":                          r.orden,
            "nombre":                         r.nombre,
            "descripcion":                    r.descripcion,
            "responsable_tipo":               r.responsable_tipo,
            "usuario_especifico_id":          str(r.usuario_especifico_id) if r.usuario_especifico_id else None,
            "usuario_especifico_nombre":      r.usuario_especifico_nombre,
            "requiere_validacion_supervisor": r.requiere_validacion_supervisor,
            "sla_validacion_horas":           r.sla_validacion_horas,
        }
        for r in result.fetchall()
    ]


@router.post("/catalogo/{catalogo_tarea_id}/etapas", status_code=201)
async def crear_etapa_plantilla(
    catalogo_tarea_id: str,
    datos: EtapaPlantillaCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Agrega un paso a la plantilla de una tarea compleja.
      Solo supervisores y admins.
    DESCRIPCION TECNICA:
      Verifica que la tarea del catálogo exista y sea compleja.
      Verifica unicidad de orden para esa tarea.
    """
    perfiles = await _obtener_perfiles(usuario_actual.id, db)
    if "supervisor" not in perfiles and "administrador" not in perfiles \
            and "dueno" not in perfiles:
        raise HTTPException(403, "Solo supervisores pueden definir etapas")

    # Verificar que la tarea sea compleja
    ct = await db.execute(sqlt(
        "SELECT es_compleja FROM catalogo_tareas WHERE id = :id AND activo = TRUE"
    ), {"id": catalogo_tarea_id})
    fila = ct.fetchone()
    if not fila:
        raise HTTPException(404, "Tarea del catálogo no encontrada")
    if not fila.es_compleja:
        raise HTTPException(400, "Esta tarea no está marcada como compleja en el catálogo")

    # Verificar unicidad del orden
    dup = await db.execute(sqlt("""
        SELECT id FROM tarea_compleja_plantilla_etapas
        WHERE catalogo_tarea_id = :ctid AND orden = :orden AND activo = TRUE
    """), {"ctid": catalogo_tarea_id, "orden": datos.orden})
    if dup.fetchone():
        raise HTTPException(400, f"Ya existe un paso con el orden {datos.orden} para esta tarea")

    nuevo_id = str(uuid_mod.uuid4())
    await db.execute(sqlt("""
        INSERT INTO tarea_compleja_plantilla_etapas
            (id, catalogo_tarea_id, orden, nombre, descripcion,
             responsable_tipo, usuario_especifico_id,
             requiere_validacion_supervisor, sla_validacion_horas,
             activo, creado_en, creado_por)
        VALUES
            (:id, :ctid, :orden, :nombre, :descripcion,
             :resp_tipo, :usuario_esp,
             :req_val, :sla,
             TRUE, NOW(), :creado_por)
    """), {
        "id":          nuevo_id,
        "ctid":        catalogo_tarea_id,
        "orden":       datos.orden,
        "nombre":      datos.nombre,
        "descripcion": datos.descripcion,
        "resp_tipo":   datos.responsable_tipo,
        "usuario_esp": datos.usuario_especifico_id,
        "req_val":     datos.requiere_validacion_supervisor,
        "sla":         datos.sla_validacion_horas,
        "creado_por":  str(usuario_actual.id),
    })
    return {"id": nuevo_id, "mensaje": "Paso agregado a la plantilla"}


@router.put("/catalogo/etapas/{etapa_id}")
async def editar_etapa_plantilla(
    etapa_id: str,
    datos: EtapaPlantillaCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Edita un paso existente de la plantilla."""
    await db.execute(sqlt("""
        UPDATE tarea_compleja_plantilla_etapas SET
            orden                          = :orden,
            nombre                         = :nombre,
            descripcion                    = :descripcion,
            responsable_tipo               = :resp_tipo,
            usuario_especifico_id          = :usuario_esp,
            requiere_validacion_supervisor = :req_val,
            sla_validacion_horas           = :sla
        WHERE id = :id AND activo = TRUE
    """), {
        "orden":      datos.orden,
        "nombre":     datos.nombre,
        "descripcion":datos.descripcion,
        "resp_tipo":  datos.responsable_tipo,
        "usuario_esp":datos.usuario_especifico_id,
        "req_val":    datos.requiere_validacion_supervisor,
        "sla":        datos.sla_validacion_horas,
        "id":         etapa_id,
    })
    return {"mensaje": "Paso actualizado"}


@router.delete("/catalogo/etapas/{etapa_id}")
async def eliminar_etapa_plantilla(
    etapa_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Baja lógica de un paso de la plantilla."""
    await db.execute(sqlt(
        "UPDATE tarea_compleja_plantilla_etapas SET activo = FALSE WHERE id = :id"
    ), {"id": etapa_id})
    return {"mensaje": "Paso eliminado de la plantilla"}


# =============================================================================
# INSTANCIACION — se llama desde crear_tarea en tareas.py
# =============================================================================

async def instanciar_ejecucion_compleja(
    tarea_id: str,
    catalogo_tarea_id: str,
    asignado_a_id: str,
    db: AsyncSession
) -> Optional[str]:
    """
    DESCRIPCION FUNCIONAL:
      Crea la ejecución y sus etapas cuando se asigna una tarea compleja.
      Retorna el ejecucion_id creado, o None si la tarea no tiene
      etapas definidas en la plantilla.
    DESCRIPCION TECNICA:
      1. Carga la plantilla de etapas ordenadas.
      2. Resuelve el supervisor del operador.
      3. Crea tarea_compleja_ejecucion.
      4. Crea una tarea_compleja_etapas por cada paso:
         - 1ra etapa: estado 'pendiente'
         - Resto: estado 'bloqueada' (secuencial)
      5. Actualiza tareas.seguimiento_complejo_id con el ejecucion_id.
    """
    # Cargar plantilla de etapas para esta tarea del catálogo
    result = await db.execute(sqlt("""
        SELECT id, orden, nombre, descripcion,
               responsable_tipo, usuario_especifico_id,
               requiere_validacion_supervisor, sla_validacion_horas
        FROM tarea_compleja_plantilla_etapas
        WHERE catalogo_tarea_id = :ctid AND activo = TRUE
        ORDER BY orden
    """), {"ctid": catalogo_tarea_id})
    etapas_plantilla = result.fetchall()

    if not etapas_plantilla:
        return None  # Sin etapas definidas → no instanciar

    # Resolver supervisor del operador
    sup_result = await db.execute(sqlt("""
        SELECT supervisor_id FROM supervisor_operador
        WHERE operador_id = :uid AND activo = TRUE
        LIMIT 1
    """), {"uid": asignado_a_id})
    sup_row       = sup_result.fetchone()
    supervisor_id = str(sup_row.supervisor_id) if sup_row else asignado_a_id

    # Crear la ejecución
    ejec_id = str(uuid_mod.uuid4())
    await db.execute(sqlt("""
        INSERT INTO tarea_compleja_ejecucion
            (id, tarea_id, etapa_actual_orden, estado_general, creado_en)
        VALUES (:id, :tarea_id, 1, 'pendiente', NOW())
    """), {"id": ejec_id, "tarea_id": tarea_id})

    # Actualizar la tarea con el id de la ejecución
    await db.execute(sqlt("""
        UPDATE tareas SET
            es_tarea_compleja      = TRUE,
            seguimiento_complejo_id = :ejec_id
        WHERE id = :tarea_id
    """), {"ejec_id": ejec_id, "tarea_id": tarea_id})

    # Crear las etapas de la instancia
    for i, ep in enumerate(etapas_plantilla):
        # Resolver asignado según tipo de responsable
        if ep.responsable_tipo == "supervisor":
            asignado_etapa = supervisor_id
        elif ep.responsable_tipo == "usuario_especifico" and ep.usuario_especifico_id:
            asignado_etapa = str(ep.usuario_especifico_id)
        else:
            asignado_etapa = asignado_a_id

        # 1ra etapa pendiente, resto bloqueadas
        estado_inicial = "pendiente" if i == 0 else "bloqueada"

        etapa_id_nueva = str(uuid_mod.uuid4())
        await db.execute(sqlt("""
            INSERT INTO tarea_compleja_etapas
                (id, ejecucion_id, plantilla_etapa_id,
                 orden, nombre, descripcion,
                 asignado_a_id, asignado_por_id,
                 estado, requiere_validacion, sla_validacion_horas,
                 activo, creado_en)
            VALUES
                (:id, :ejec_id, :plantilla_id,
                 :orden, :nombre, :descripcion,
                 :asignado, :asignado_por,
                 :estado, :req_val, :sla,
                 TRUE, NOW())
        """), {
            "id":           etapa_id_nueva,
            "ejec_id":      ejec_id,
            "plantilla_id": str(ep.id),
            "orden":        ep.orden,
            "nombre":       ep.nombre,
            "descripcion":  ep.descripcion,
            "asignado":     asignado_etapa,
            "asignado_por": asignado_a_id,
            "estado":       estado_inicial,
            "req_val":      ep.requiere_validacion_supervisor,
            "sla":          ep.sla_validacion_horas,
        })

    return ejec_id


# =============================================================================
# SEGUIMIENTO DE ETAPAS — ejecución diaria
# =============================================================================

@router.get("/tarea/{tarea_id}/etapas")
async def obtener_etapas_tarea(
    tarea_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Retorna el seguimiento completo de una tarea compleja:
      estado general y lista de etapas. Usado por el widget,
      el dashboard y la pantalla de seguimiento.
    """
    # Obtener la ejecución
    ejec = await db.execute(sqlt("""
        SELECT id, etapa_actual_orden, estado_general
        FROM tarea_compleja_ejecucion
        WHERE tarea_id = :tid
        LIMIT 1
    """), {"tid": tarea_id})
    ejec_row = ejec.fetchone()
    if not ejec_row:
        raise HTTPException(404, "Esta tarea no tiene ejecución compleja registrada")

    # Cargar etapas con datos enriquecidos
    result = await db.execute(sqlt("""
        SELECT
            e.id, e.orden, e.nombre, e.descripcion,
            e.asignado_a_id, e.estado,
            e.es_reasignada, e.motivo_reasignacion,
            e.requiere_validacion, e.sla_validacion_horas,
            e.inicio_real, e.fin_real, e.tiempo_trabajado_minutos,
            e.validada_por_id, e.fecha_validacion, e.comentario_validacion,
            e.vencimiento_sla, e.sla_vencido,
            e.comentario_operador,
            u.nombre  || ' ' || u.apellido  AS asignado_nombre,
            v.nombre  || ' ' || v.apellido  AS validador_nombre,
            ra.nombre || ' ' || ra.apellido AS reasignada_de_nombre
        FROM tarea_compleja_etapas e
        LEFT JOIN usuarios u  ON e.asignado_a_id    = u.id
        LEFT JOIN usuarios v  ON e.validada_por_id  = v.id
        LEFT JOIN usuarios ra ON e.reasignada_de_id = ra.id
        WHERE e.ejecucion_id = :ejec_id AND e.activo = TRUE
        ORDER BY e.orden
    """), {"ejec_id": str(ejec_row.id)})
    etapas = result.fetchall()

    return {
        "ejecucion_id": str(ejec_row.id),
        "etapa_actual": ejec_row.etapa_actual_orden,
        "estado_general": ejec_row.estado_general,
        "total_etapas": len(etapas),
        "etapas": [
            {
                "id":                       str(e.id),
                "orden":                    e.orden,
                "nombre":                   e.nombre,
                "descripcion":              e.descripcion,
                "estado":                   e.estado,
                "asignado_id":              str(e.asignado_a_id) if e.asignado_a_id else None,
                "asignado_nombre":          e.asignado_nombre,
                "es_reasignada":            e.es_reasignada,
                "motivo_reasignacion":      e.motivo_reasignacion,
                "requiere_validacion":      e.requiere_validacion,
                "sla_validacion_horas":     e.sla_validacion_horas,
                "inicio_real":              e.inicio_real.isoformat()     if e.inicio_real     else None,
                "fin_real":                 e.fin_real.isoformat()        if e.fin_real        else None,
                "tiempo_trabajado_minutos": e.tiempo_trabajado_minutos,
                "vencimiento_sla":          e.vencimiento_sla.isoformat() if e.vencimiento_sla else None,
                "sla_vencido":              e.sla_vencido,
                "comentario_operador":      e.comentario_operador,
                "comentario_validacion":    e.comentario_validacion,
                "validador_nombre":         e.validador_nombre,
                "fecha_validacion":         e.fecha_validacion.isoformat() if e.fecha_validacion else None,
            }
            for e in etapas
        ],
    }


@router.post("/etapa/{etapa_id}/iniciar")
async def iniciar_etapa(
    etapa_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      PLAY — inicia una etapa. Solo el asignado puede iniciarla.
      La etapa debe estar en estado 'pendiente'.
      No puede haber otra etapa en curso en la misma ejecución.
    """
    etapa = await db.execute(sqlt("""
        SELECT id, ejecucion_id, estado, asignado_a_id, orden
        FROM tarea_compleja_etapas
        WHERE id = :id AND activo = TRUE
    """), {"id": etapa_id})
    e = etapa.fetchone()
    if not e:
        raise HTTPException(404, "Etapa no encontrada")
    if str(e.asignado_a_id) != str(usuario_actual.id):
        raise HTTPException(403, "Solo el asignado puede iniciar esta etapa")
    if e.estado not in ("pendiente", "pausada"):
        raise HTTPException(400, f"La etapa está en estado '{e.estado}'. Solo se puede iniciar desde 'pendiente' o 'pausada'")

    # Verificar que no haya otra etapa en curso
    en_curso = await db.execute(sqlt("""
        SELECT id FROM tarea_compleja_etapas
        WHERE ejecucion_id = :ejec_id AND estado = 'en_curso' AND activo = TRUE
    """), {"ejec_id": str(e.ejecucion_id)})
    if en_curso.fetchone():
        raise HTTPException(400, "Ya hay una etapa en curso en esta tarea. Pausala o finalizala primero")

    ahora = datetime.now(TZ).replace(tzinfo=None)
    await db.execute(sqlt("""
        UPDATE tarea_compleja_etapas
        SET estado = 'en_curso', inicio_real = :ahora
        WHERE id = :id
    """), {"ahora": ahora, "id": etapa_id})

    await db.execute(sqlt("""
        UPDATE tarea_compleja_ejecucion
        SET etapa_actual_orden = :orden, estado_general = 'en_progreso'
        WHERE id = :ejec_id
    """), {"orden": e.orden, "ejec_id": str(e.ejecucion_id)})

    return {"mensaje": "Etapa iniciada", "inicio": ahora.isoformat()}


@router.post("/etapa/{etapa_id}/pausar")
async def pausar_etapa(
    etapa_id: str,
    datos: AccionEtapaRequest,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      PAUSA — el motivo es obligatorio. Acumula el tiempo parcial.
    """
    e = (await db.execute(sqlt(
        "SELECT id, asignado_a_id, estado, inicio_real, tiempo_trabajado_minutos FROM tarea_compleja_etapas WHERE id = :id"
    ), {"id": etapa_id})).fetchone()
    if not e:
        raise HTTPException(404, "Etapa no encontrada")
    if str(e.asignado_a_id) != str(usuario_actual.id):
        raise HTTPException(403, "Solo el asignado puede pausar esta etapa")
    if e.estado != "en_curso":
        raise HTTPException(400, "La etapa no está en curso")
    if not datos.motivo:
        raise HTTPException(400, "El motivo de la pausa es obligatorio")

    ahora       = datetime.now(TZ).replace(tzinfo=None)
    mins_extra  = max(0, int((ahora - e.inicio_real.replace(tzinfo=None)).total_seconds() / 60)) if e.inicio_real else 0
    tiempo_acum = (e.tiempo_trabajado_minutos or 0) + mins_extra

    await db.execute(sqlt("""
        UPDATE tarea_compleja_etapas SET
            estado                   = 'pausada',
            inicio_real              = NULL,
            tiempo_trabajado_minutos = :tiempo,
            comentario_operador      = COALESCE(:com, comentario_operador)
        WHERE id = :id
    """), {
        "tiempo": tiempo_acum,
        "com":    f"[Pausa: {datos.motivo}]" + (f" {datos.comentario}" if datos.comentario else ""),
        "id":     etapa_id,
    })
    return {"mensaje": "Etapa pausada", "tiempo_acumulado_minutos": tiempo_acum}


@router.post("/etapa/{etapa_id}/finalizar")
async def finalizar_etapa(
    etapa_id: str,
    datos: AccionEtapaRequest,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      FIN — finaliza una etapa.
      Si requiere validación → pasa a 'validacion_pendiente' y genera
        una tarea de validación para el supervisor.
      Si no → pasa a 'completada' y desbloquea la siguiente etapa.
        Si era la última, completa la tarea global.
    """
    e = (await db.execute(sqlt("""
        SELECT id, ejecucion_id, orden, asignado_a_id, estado,
               inicio_real, tiempo_trabajado_minutos,
               requiere_validacion, sla_validacion_horas
        FROM tarea_compleja_etapas
        WHERE id = :id AND activo = TRUE
    """), {"id": etapa_id})).fetchone()
    if not e:
        raise HTTPException(404, "Etapa no encontrada")
    if str(e.asignado_a_id) != str(usuario_actual.id):
        raise HTTPException(403, "Solo el asignado puede finalizar esta etapa")
    if e.estado not in ("en_curso", "pendiente"):
        raise HTTPException(400, f"No se puede finalizar una etapa en estado '{e.estado}'")

    ahora       = datetime.now(TZ).replace(tzinfo=None)
    mins_extra  = max(0, int((ahora - e.inicio_real.replace(tzinfo=None)).total_seconds() / 60)) if e.inicio_real else 0
    tiempo_total = (e.tiempo_trabajado_minutos or 0) + mins_extra
    ejec_id     = str(e.ejecucion_id)

    if e.requiere_validacion:
        # Calcular vencimiento SLA
        vencimiento = (ahora + timedelta(hours=e.sla_validacion_horas)) if e.sla_validacion_horas else None

        await db.execute(sqlt("""
            UPDATE tarea_compleja_etapas SET
                estado                   = 'validacion_pendiente',
                fin_real                 = :ahora,
                tiempo_trabajado_minutos = :tiempo,
                vencimiento_sla          = :venc,
                comentario_operador      = COALESCE(:com, comentario_operador)
            WHERE id = :id
        """), {"ahora": ahora, "tiempo": tiempo_total,
               "venc": vencimiento, "com": datos.comentario, "id": etapa_id})

        # Generar tarea de validación para el supervisor
        sup = (await db.execute(sqlt("""
            SELECT supervisor_id FROM supervisor_operador
            WHERE operador_id = :uid AND activo = TRUE LIMIT 1
        """), {"uid": str(e.asignado_a_id)})).fetchone()

        if sup:
            # Datos de la tarea original para la tarea de validación
            t_orig = (await db.execute(sqlt("""
                SELECT t.fecha_planificada, t.prioridad, te.nombre AS etapa_nombre
                FROM tarea_compleja_ejecucion ex
                JOIN tareas t ON ex.tarea_id = t.id
                JOIN tarea_compleja_etapas te ON te.id = :eid
                WHERE ex.id = :ejec_id
            """), {"ejec_id": ejec_id, "eid": etapa_id})).fetchone()

            if t_orig:
                val_id = str(uuid_mod.uuid4())
                await db.execute(sqlt("""
                    INSERT INTO tareas (
                        id, nombre_personalizado, asignado_a_id,
                        fecha_planificada, prioridad, estado,
                        tipo_creacion, comentario_supervisor,
                        activa, creado_en, creada_por_id
                    ) VALUES (
                        :id, :nombre, :asignado,
                        :fecha, :prioridad, 'pendiente',
                        'supervisor', :comentario,
                        TRUE, NOW(), :creador
                    )
                """), {
                    "id":        val_id,
                    "nombre":    f"✅ Validar: {t_orig.etapa_nombre}",
                    "asignado":  str(sup.supervisor_id),
                    "fecha":     t_orig.fecha_planificada,
                    "prioridad": t_orig.prioridad,
                    "comentario":f"Validar etapa '{t_orig.etapa_nombre}'" +
                                 (f" — SLA: {e.sla_validacion_horas}h" if e.sla_validacion_horas else ""),
                    "creador":   str(usuario_actual.id),
                })
                await db.execute(sqlt("""
                    UPDATE tarea_compleja_etapas SET tarea_validacion_id = :vid WHERE id = :eid
                """), {"vid": val_id, "eid": etapa_id})

        return {
            "mensaje":     "Etapa completada — pendiente de validación del supervisor",
            "estado":      "validacion_pendiente",
            "vencimiento": vencimiento.isoformat() if vencimiento else None,
        }

    else:
        # Sin validación → completar directamente
        await db.execute(sqlt("""
            UPDATE tarea_compleja_etapas SET
                estado                   = 'completada',
                fin_real                 = :ahora,
                tiempo_trabajado_minutos = :tiempo,
                comentario_operador      = COALESCE(:com, comentario_operador)
            WHERE id = :id
        """), {"ahora": ahora, "tiempo": tiempo_total,
               "com": datos.comentario, "id": etapa_id})

        await _avanzar_o_completar(ejec_id, e.orden, db)

        return {"mensaje": "Etapa completada ✅",
                "tiempo_trabajado_minutos": tiempo_total}


async def _avanzar_o_completar(ejec_id: str, orden_completado: int, db: AsyncSession):
    """
    DESCRIPCION FUNCIONAL:
      Tras completar (o validar) una etapa, desbloquea la siguiente
      o cierra la ejecución y completa la tarea global si no quedan
      etapas pendientes.
    """
    # Buscar la siguiente etapa bloqueada
    prox = (await db.execute(sqlt("""
        SELECT id, orden FROM tarea_compleja_etapas
        WHERE ejecucion_id = :ejec_id
          AND orden > :orden
          AND estado = 'bloqueada'
          AND activo = TRUE
        ORDER BY orden LIMIT 1
    """), {"ejec_id": ejec_id, "orden": orden_completado})).fetchone()

    if prox:
        await db.execute(sqlt(
            "UPDATE tarea_compleja_etapas SET estado = 'pendiente' WHERE id = :id"
        ), {"id": str(prox.id)})
        await db.execute(sqlt(
            "UPDATE tarea_compleja_ejecucion SET etapa_actual_orden = :orden WHERE id = :ejec_id"
        ), {"orden": prox.orden, "ejec_id": ejec_id})
    else:
        # Verificar si todas las etapas están completadas
        conteo = (await db.execute(sqlt("""
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) AS completadas
            FROM tarea_compleja_etapas
            WHERE ejecucion_id = :ejec_id AND activo = TRUE
        """), {"ejec_id": ejec_id})).fetchone()

        if conteo and conteo.total == conteo.completadas:
            # Todas completadas → cerrar ejecución y tarea global con hora Argentina
            ahora_ar = datetime.now(TZ).replace(tzinfo=None)
            await db.execute(sqlt("""
                UPDATE tarea_compleja_ejecucion
                SET estado_general = 'completada', completada_en = :ahora
                WHERE id = :ejec_id
            """), {"ejec_id": ejec_id, "ahora": ahora_ar})

            t_row = (await db.execute(sqlt(
                "SELECT tarea_id FROM tarea_compleja_ejecucion WHERE id = :ejec_id"
            ), {"ejec_id": ejec_id})).fetchone()

            if t_row:
                await db.execute(sqlt("""
                    UPDATE tareas SET estado = 'completada', fin_real = :ahora
                    WHERE id = :tid
                """), {"tid": str(t_row.tarea_id), "ahora": ahora_ar})


# =============================================================================
# REASIGNACION DE ETAPA
# =============================================================================

@router.post("/etapa/{etapa_id}/reasignar")
async def reasignar_etapa(
    etapa_id: str,
    datos: ReasignarEtapaRequest,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      El operador reasigna una etapa a otro usuario.
      La responsabilidad de la tarea global sigue siendo del operador original.
      Queda registrado en auditoría.
    """
    e = (await db.execute(sqlt(
        "SELECT id, asignado_a_id, estado FROM tarea_compleja_etapas WHERE id = :id"
    ), {"id": etapa_id})).fetchone()
    if not e:
        raise HTTPException(404, "Etapa no encontrada")
    if str(e.asignado_a_id) != str(usuario_actual.id):
        raise HTTPException(403, "Solo el asignado actual puede reasignar esta etapa")
    if e.estado not in ("pendiente", "bloqueada"):
        raise HTTPException(400, f"Solo se puede reasignar en estado pendiente o bloqueada (actual: '{e.estado}')")

    await db.execute(sqlt("""
        UPDATE tarea_compleja_etapas SET
            asignado_a_id       = :nuevo,
            asignado_por_id     = :por,
            es_reasignada       = TRUE,
            motivo_reasignacion = :motivo,
            reasignada_de_id    = :anterior
        WHERE id = :id
    """), {
        "nuevo":    datos.nuevo_asignado_id,
        "por":      str(usuario_actual.id),
        "motivo":   datos.motivo,
        "anterior": str(e.asignado_a_id),
        "id":       etapa_id,
    })
    return {"mensaje": "Etapa reasignada. La responsabilidad global sigue siendo del operador original."}


# =============================================================================
# BANDEJA DE VALIDACIONES — supervisor
# =============================================================================

@router.get("/bandeja-validaciones")
async def bandeja_validaciones(
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Bandeja del supervisor con las etapas esperando su validación.
      Incluye el SLA restante y marca como urgente si quedan menos de 2h.
    """
    result = await db.execute(sqlt("""
        SELECT
            e.id AS etapa_id, e.orden, e.nombre AS etapa_nombre,
            e.tiempo_trabajado_minutos, e.sla_validacion_horas,
            e.vencimiento_sla, e.sla_vencido, e.comentario_operador,
            e.fin_real,
            ex.id AS ejecucion_id,
            t.id  AS tarea_id,
            COALESCE(ct.nombre, t.nombre_personalizado, 'Tarea') AS tarea_nombre,
            u.nombre || ' ' || u.apellido AS operador_nombre,
            c.razon_social AS cliente_nombre,
            EXTRACT(EPOCH FROM (e.vencimiento_sla - NOW())) / 3600 AS horas_restantes
        FROM tarea_compleja_etapas e
        JOIN tarea_compleja_ejecucion ex ON e.ejecucion_id    = ex.id
        JOIN tareas t                    ON ex.tarea_id        = t.id
        LEFT JOIN catalogo_tareas ct     ON t.catalogo_tarea_id = ct.id
        LEFT JOIN usuarios u             ON e.asignado_a_id     = u.id
        LEFT JOIN clientes c             ON t.cliente_id        = c.id
        WHERE e.estado  = 'validacion_pendiente'
          AND e.activo  = TRUE
          AND t.activa  = TRUE
          AND EXISTS (
              SELECT 1 FROM supervisor_operador so
              WHERE so.supervisor_id = :uid
                AND so.operador_id   = e.asignado_a_id
                AND so.activo        = TRUE
          )
        ORDER BY e.vencimiento_sla NULLS LAST, e.fin_real
    """), {"uid": str(usuario_actual.id)})

    return [
        {
            "etapa_id":             str(r.etapa_id),
            "ejecucion_id":         str(r.ejecucion_id),
            "tarea_id":             str(r.tarea_id),
            "tarea_nombre":         r.tarea_nombre,
            "etapa_nombre":         r.etapa_nombre,
            "etapa_orden":          r.orden,
            "operador_nombre":      r.operador_nombre,
            "cliente_nombre":       r.cliente_nombre,
            "tiempo_min":           r.tiempo_trabajado_minutos,
            "comentario_operador":  r.comentario_operador,
            "fin_real":             r.fin_real.isoformat() if r.fin_real else None,
            "vencimiento_sla":      r.vencimiento_sla.isoformat() if r.vencimiento_sla else None,
            "horas_restantes":      round(float(r.horas_restantes), 1) if r.horas_restantes else None,
            "sla_vencido":          r.sla_vencido,
            "urgente":              r.horas_restantes is not None and float(r.horas_restantes) < 2,
        }
        for r in result.fetchall()
    ]


@router.post("/etapa/{etapa_id}/validar")
async def validar_etapa(
    etapa_id: str,
    datos: ValidarEtapaRequest,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      El supervisor aprueba o rechaza una etapa en validacion_pendiente.
      Aprobada: completa la etapa y desbloquea la siguiente.
      Rechazada: la etapa vuelve a pendiente para que el operador rehaga.
    """
    e = (await db.execute(sqlt("""
        SELECT id, ejecucion_id, orden, estado
        FROM tarea_compleja_etapas WHERE id = :id AND activo = TRUE
    """), {"id": etapa_id})).fetchone()
    if not e:
        raise HTTPException(404, "Etapa no encontrada")
    if e.estado != "validacion_pendiente":
        raise HTTPException(400, f"La etapa no está en validacion_pendiente (estado: '{e.estado}')")

    ahora  = datetime.now(TZ).replace(tzinfo=None)
    ejec_id = str(e.ejecucion_id)

    if datos.aprobada:
        # ── APROBAR: completar etapa y desbloquear la siguiente ──
        await db.execute(sqlt("""
            UPDATE tarea_compleja_etapas SET
                estado                = 'completada',
                validada_por_id       = :vid,
                fecha_validacion      = :ahora,
                comentario_validacion = :comentario,
                requiere_correccion   = FALSE
            WHERE id = :id
        """), {"vid": str(usuario_actual.id), "ahora": ahora,
               "comentario": datos.comentario, "id": etapa_id})
        # Completar la tarea de validación del supervisor si existe
        await db.execute(sqlt("""
            UPDATE tareas SET estado = 'completada'
            WHERE id = (
                SELECT tarea_validacion_id FROM tarea_compleja_etapas WHERE id = :eid
            ) AND tarea_validacion_id IS NOT NULL
        """), {"eid": etapa_id})
        await _avanzar_o_completar(ejec_id, e.orden, db)
        return {"mensaje": "Etapa aprobada ✅. Se desbloqueó la siguiente."}

    else:
        # ── RECHAZAR: motivo obligatorio ─────────────────────────
        if not datos.comentario or not datos.comentario.strip():
            raise HTTPException(400, "El motivo de rechazo es obligatorio")

        accion = datos.accion_rechazo or "corregir"

        if accion == "desestimar":
            # Cancelar toda la tarea compleja
            await db.execute(sqlt("""
                UPDATE tarea_compleja_etapas
                SET estado = 'bloqueada', activo = TRUE
                WHERE ejecucion_id = :ejec_id AND estado NOT IN ('completada')
            """), {"ejec_id": ejec_id})

            await db.execute(sqlt("""
                UPDATE tarea_compleja_ejecucion
                SET estado_general = 'cancelada', fin_real = :ahora
                WHERE id = :id
            """), {"ahora": ahora, "id": ejec_id})

            # Obtener info de la tarea para crear acuse de recibo
            tarea_info = (await db.execute(sqlt("""
                SELECT t.id, t.asignado_a_id, t.empresa_id, t.fecha_planificada,
                       COALESCE(ct.nombre, t.nombre_personalizado, 'Tarea cancelada') AS nombre
                FROM tarea_compleja_ejecucion ex
                JOIN tareas t ON ex.tarea_id = t.id
                LEFT JOIN catalogo_tareas ct ON t.catalogo_tarea_id = ct.id
                WHERE ex.id = :ejec_id
            """), {"ejec_id": ejec_id})).fetchone()

            if tarea_info:
                # Marcar la tarea original como cancelada
                await db.execute(sqlt("""
                    UPDATE tareas SET estado = 'completada', activo = FALSE
                    WHERE id = :id
                """), {"id": str(tarea_info.id)})

                # Crear tarea de acuse de recibo para el operador
                acuse_id = str(uuid_mod.uuid4())
                from datetime import date
                await db.execute(sqlt("""
                    INSERT INTO tareas (
                        id, nombre_personalizado, descripcion,
                        asignado_a_id, empresa_id, fecha_planificada,
                        prioridad, estado, creada_por_id,
                        tipo_creacion, comentario_supervisor,
                        activa, creado_en
                    ) VALUES (
                        :id,
                        :nombre,
                        :desc,
                        :asignado, :empresa, :fecha,
                        'alta', 'pendiente', :creador,
                        'sistema', :comentario,
                        TRUE, NOW()
                    )
                """), {
                    "id":       acuse_id,
                    "nombre":   f"⚠️ CANCELADA: {tarea_info.nombre}",
                    "desc":     f"Tarea cancelada por el supervisor. Motivo: {datos.comentario}",
                    "asignado": str(tarea_info.asignado_a_id),
                    "empresa":  str(tarea_info.empresa_id) if tarea_info.empresa_id else None,
                    "fecha":    date.today(),
                    "creador":  str(usuario_actual.id),
                    "comentario": f"⚠️ Esta tarea fue CANCELADA. Motivo: {datos.comentario}. Por favor confirme que tomó conocimiento finalizando esta tarea.",
                })

            # Completar la tarea de validación del supervisor
            await db.execute(sqlt("""
                UPDATE tareas SET estado = 'completada'
                WHERE id = (
                    SELECT tarea_validacion_id FROM tarea_compleja_etapas WHERE id = :eid
                ) AND tarea_validacion_id IS NOT NULL
            """), {"eid": etapa_id})
            await db.commit()
            return {"mensaje": "Tarea desestimada ❌. Se notificó al operador.", "accion": "desestimar"}

        else:
            # accion == "corregir": vuelve al mismo paso con indicador visible
            prioridad_override = datos.prioridad_rechazo

            update_params = {
                "vid":       str(usuario_actual.id),
                "ahora":     ahora,
                "comentario": datos.comentario,
                "id":        etapa_id,
            }

            # Agregar nota al historial de comentarios
            historial_nota = f"[RECHAZADO {ahora.strftime('%d/%m %H:%M')} por supervisor] {datos.comentario}"

            await db.execute(sqlt("""
                UPDATE tarea_compleja_etapas SET
                    estado                = 'pendiente',
                    inicio_real           = NULL,
                    fin_real              = NULL,
                    tiempo_trabajado_minutos = 0,
                    validada_por_id       = :vid,
                    fecha_validacion      = :ahora,
                    comentario_validacion = :comentario,
                    requiere_correccion   = TRUE,
                    historial_rechazos    = COALESCE(historial_rechazos, '') || :nota
                WHERE id = :id
            """), {**update_params, "nota": historial_nota + "\n"})


            # Si se especificó prioridad override, actualizar la tarea principal
            if prioridad_override:
                await db.execute(sqlt("""
                    UPDATE tareas SET prioridad = :prio
                    WHERE id = (
                        SELECT tarea_id FROM tarea_compleja_ejecucion WHERE id = :ejec_id
                    )
                """), {"prio": prioridad_override, "ejec_id": ejec_id})

            # Completar la tarea de validación del supervisor
            await db.execute(sqlt("""
                UPDATE tareas SET estado = 'completada'
                WHERE id = (
                    SELECT tarea_validacion_id FROM tarea_compleja_etapas WHERE id = :eid
                ) AND tarea_validacion_id IS NOT NULL
            """), {"eid": etapa_id})
            await db.commit()
            return {"mensaje": "Etapa rechazada ❌. El operador debe corregir y reenviar.", "accion": "corregir"}

@router.get("/bandeja-operador")
async def bandeja_operador(
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Lista las etapas del operador que están esperando validación
      del supervisor. El operador ve en qué paso está bloqueado
      y quién debe validar.
    """
    result = await db.execute(sqlt("""
        SELECT
            te.id            AS etapa_id,
            te.orden         AS etapa_orden,
            te.nombre        AS etapa_nombre,
            te.estado        AS etapa_estado,
            te.requiere_correccion,
            te.historial_rechazos,
            te.comentario_validacion,
            te.tiempo_trabajado_minutos,
            te.vencimiento_sla,
            t.id             AS tarea_id,
            COALESCE(ct.nombre, t.nombre_personalizado, 'Sin nombre') AS tarea_nombre,
            c.razon_social   AS cliente_nombre,
            u_val.nombre || ' ' || u_val.apellido AS validador_nombre
        FROM tarea_compleja_etapas te
        JOIN tarea_compleja_ejecucion ex ON te.ejecucion_id = ex.id
        JOIN tareas t                    ON ex.tarea_id = t.id
        LEFT JOIN catalogo_tareas ct     ON t.catalogo_tarea_id = ct.id
        LEFT JOIN clientes c             ON t.cliente_id = c.id
        LEFT JOIN usuarios u_val         ON te.validada_por_id = u_val.id
        WHERE te.asignado_a_id = :uid
          AND te.activo = TRUE
          AND te.estado IN ('validacion_pendiente', 'rechazada', 'pendiente')
          AND te.requiere_correccion = TRUE
          OR (te.asignado_a_id = :uid AND te.activo = TRUE
              AND te.estado = 'validacion_pendiente')
        ORDER BY te.estado, te.vencimiento_sla NULLS LAST
    """), {"uid": str(usuario_actual.id)})

    return [
        {
            "etapa_id":            str(r.etapa_id),
            "etapa_orden":         r.etapa_orden,
            "etapa_nombre":        r.etapa_nombre,
            "etapa_estado":        r.etapa_estado,
            "requiere_correccion": r.requiere_correccion,
            "historial_rechazos":  r.historial_rechazos,
            "comentario_validacion": r.comentario_validacion,
            "tarea_id":            str(r.tarea_id),
            "tarea_nombre":        r.tarea_nombre,
            "cliente_nombre":      r.cliente_nombre,
            "validador_nombre":    r.validador_nombre,
            "vencimiento_sla":     r.vencimiento_sla.isoformat() if r.vencimiento_sla else None,
        }
        for r in result.fetchall()
    ]
