"""
API de Tareas — Módulo central del sistema
Handles: CRUD, play/pausa/fin, herencia, métricas del día
v1.1.0: fix timezone America/Argentina/Buenos_Aires en inicio_real y fin_real
v1.2.0: filtra sugerencias por meses_activos en agenda_sugerencias
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update, func
from typing import Optional, List
from datetime import date, datetime, timedelta, timezone
from pydantic import BaseModel, UUID4
import pytz

from app.core.database import get_db
from app.core.config import settings
from app.api.auth import obtener_usuario_actual, obtener_empresa_id
from app.models.usuario import Usuario
from app.models.tarea import Tarea, TareaPausa, TareaComentario
from app.services.auditoria import registrar_auditoria
import calendar as cal_module   # Para calcular dias del mes

router = APIRouter()
# Zona horaria Argentina — los timestamps inicio_real/fin_real se guardan en hora local
TZ = pytz.timezone('America/Argentina/Buenos_Aires')


# ============================================================
# SCHEMAS (modelos de datos para requests/responses)
# ============================================================

class TareaCrear(BaseModel):
    catalogo_tarea_id: Optional[UUID4] = None
    nombre_personalizado: Optional[str] = None
    descripcion: Optional[str] = None
    rubro_id: UUID4
    asignado_a_id: UUID4
    cliente_id: Optional[UUID4] = None
    servicio_id: Optional[UUID4] = None
    fecha_planificada: date
    fecha_vencimiento: Optional[date] = None
    sla_horas:         Optional[int]  = None
    prioridad: str = "media"
    comentario_supervisor: Optional[str] = None


class TareaActualizar(BaseModel):
    descripcion: Optional[str] = None
    fecha_planificada: Optional[date] = None
    prioridad: Optional[str] = None
    comentario_supervisor: Optional[str] = None
    comentario_operador: Optional[str] = None


class PausarTareaRequest(BaseModel):
    motivo: str


class FinalizarTareaRequest(BaseModel):
    comentario_operador: Optional[str] = None


class ComentarioRequest(BaseModel):
    comentario: str
    tipo: str = "general"


# ============================================================
# ENDPOINTS
# ============================================================

"""
=============================================================
Versión: v1.0.3
-------------------------------------------------------------
PROBLEMA: el widget muestra tareas de otros usuarios porque
listar_tareas no filtra bien por asignado_a_id cuando el
usuario es operador.

SOLUCION: cuando el usuario NO es supervisor/admin/dueño,
forzar el filtro asignado_a_id = usuario_actual.id
independientemente de si viene el parámetro usuario_id.

=============================================================
"""

@router.get("/")
async def listar_tareas(
    fecha:       Optional[date] = Query(default=None),
    usuario_id:  Optional[str]  = Query(default=None),
    estado:      Optional[str]  = Query(default=None),
    usuario_actual: Usuario     = Depends(obtener_usuario_actual),
    empresa_id:    str          = Depends(obtener_empresa_id),
    db: AsyncSession             = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Lista las tareas del día para el usuario logueado.
      FIX v1.0.3: los operadores SIEMPRE ven solo SUS tareas,
      ignorando el parámetro usuario_id si viene en la request.
      Los supervisores pueden ver las de cualquier operador.
    DESCRIPCION TECNICA:
      SQL directo con JOINs para enriquecer nombres.
      El filtro de usuario se aplica según el perfil:
      - operador → WHERE asignado_a_id = usuario_actual.id (forzado)
      - supervisor/admin → puede filtrar por usuario_id o ver todos
    """
    from sqlalchemy import text as sqlt

    if fecha is None:
        fecha = date.today()

    # Determinar si es supervisor o admin
    perfiles      = await _obtener_perfiles(usuario_actual.id, db)
    es_supervisor = "supervisor" in perfiles or "dueno" in perfiles \
                    or "administrador" in perfiles

    # Construir filtros dinámicos
    filtros = [
        "t.activa = TRUE",
        "t.fecha_planificada = :fecha",
    ]
    params = {"fecha": fecha}

    if es_supervisor:
        # Supervisor puede filtrar por usuario específico o ver todos
        if usuario_id:
            filtros.append("t.asignado_a_id = :uid")
            params["uid"] = usuario_id
        # Si no viene usuario_id, ve todos los de su equipo (sin filtro extra)
    else:
        # Operador: SIEMPRE solo sus tareas — ignorar usuario_id externo
        filtros.append("t.asignado_a_id = :uid")
        params["uid"] = str(usuario_actual.id)

    if estado:
        filtros.append("t.estado = :estado")
        params["estado"] = estado

    where = " AND ".join(filtros)

    result = await db.execute(sqlt(f"""
        SELECT
            t.id,
            t.estado,
            t.prioridad,
            t.fecha_planificada,
            t.fecha_vencimiento,
            t.inicio_real,
            t.fin_real,
            t.tiempo_trabajado_minutos,
            t.es_heredada,
            t.sla_horas,
            t.es_tarea_compleja,
            t.seguimiento_complejo_id,
            t.tipo_creacion,
            t.comentario_supervisor,
            t.comentario_operador,
            t.asignado_a_id,
            t.cliente_id,
            t.servicio_id,
            t.catalogo_tarea_id,
            COALESCE(ct.nombre, t.nombre_personalizado, 'Sin nombre') AS tarea_nombre,
            COALESCE(ct.codigo, '')                                   AS tarea_codigo,
            u.nombre  || ' ' || u.apellido  AS operador_nombre,
            c.razon_social                  AS cliente_nombre,
            s.nombre                        AS servicio_nombre,
            -- Para tareas complejas: datos del seguimiento
            tce.etapa_actual_orden,
            (SELECT COUNT(*) FROM tarea_compleja_etapas tce2
             WHERE tce2.ejecucion_id = tce.id AND tce2.activo = TRUE) AS total_etapas
        FROM tareas t
        JOIN  usuarios u      ON t.asignado_a_id      = u.id
        LEFT JOIN catalogo_tareas ct ON t.catalogo_tarea_id = ct.id
        LEFT JOIN clientes    c  ON t.cliente_id          = c.id
        LEFT JOIN servicios   s  ON t.servicio_id         = s.id
        LEFT JOIN tarea_compleja_ejecucion tce ON tce.tarea_id = t.id
        WHERE {where}
        ORDER BY
            CASE t.estado
                WHEN 'en_curso'   THEN 0
                WHEN 'pendiente'  THEN 1
                WHEN 'pausada'    THEN 2
                WHEN 'completada' THEN 3
                WHEN 'vencida'    THEN 4
                ELSE 5
            END,
            CASE t.prioridad
                WHEN 'urgente' THEN 0
                WHEN 'alta'    THEN 1
                WHEN 'media'   THEN 2
                WHEN 'baja'    THEN 3
                ELSE 4
            END,
            t.creado_en
    """), params)

    return [
        {
            "id":                       str(r.id),
            "tarea_nombre":             r.tarea_nombre,
            "tarea_codigo":             r.tarea_codigo,
            "estado":                   r.estado,
            "prioridad":                r.prioridad,
            "fecha_planificada":        r.fecha_planificada.isoformat() if r.fecha_planificada else None,
            "fecha_vencimiento":        r.fecha_vencimiento.isoformat() if r.fecha_vencimiento else None,
            "inicio_real":              r.inicio_real.isoformat()       if r.inicio_real       else None,
            "fin_real":                 r.fin_real.isoformat()          if r.fin_real          else None,
            "tiempo_trabajado_minutos": r.tiempo_trabajado_minutos,
            "es_heredada":              r.es_heredada,
            "sla_horas":               r.sla_horas,
            "es_tarea_compleja":        r.es_tarea_compleja,
            "seguimiento_complejo_id":  str(r.seguimiento_complejo_id) if r.seguimiento_complejo_id else None,
            "etapa_actual":             r.etapa_actual_orden,
            "total_etapas":             r.total_etapas,
            "tipo_creacion":            r.tipo_creacion,
            "comentario_supervisor":    r.comentario_supervisor,
            "comentario_operador":      r.comentario_operador,
            "asignado_a_id":            str(r.asignado_a_id),
            "operador_nombre":          r.operador_nombre,
            "cliente_id":               str(r.cliente_id)    if r.cliente_id    else None,
            "cliente_nombre":           r.cliente_nombre,
            "servicio_id":              str(r.servicio_id)   if r.servicio_id   else None,
            "servicio_nombre":          r.servicio_nombre,
        }
        for r in result.fetchall()
    ]


"""
=============================================================
INSTRUCCION: reemplazar la funcion crear_tarea en tareas.py
Versión del fix: v1.0.2
-------------------------------------------------------------
DESCRIPCION DEL PROBLEMA:
  SQLAlchemy lanza NoReferencedTableError para catalogo_tareas,
  rubros_tarea, servicios, clientes al hacer db.flush() del ORM.
  Causa: esas tablas existen en BD pero no tienen modelo ORM
  registrado en app/models/, entonces SQLAlchemy no puede
  resolver las FK al construir el metadata en tiempo de ejecucion.

SOLUCION:
  Reemplazar el INSERT via ORM (db.add(tarea)) por SQL directo
  con text(). Asi SQLAlchemy no necesita resolver el metadata
  completo — solo ejecuta el SQL crudo contra la BD.

INSTRUCCION DE APLICACION:
  En tareas.py, localizar el decorador:
    @router.post("/", status_code=201)
    async def crear_tarea(...)
  Y reemplazar TODA esa funcion (hasta el proximo @router)
  por el codigo de abajo.
=============================================================
"""

@router.post("/", status_code=201)
async def crear_tarea(
    datos: TareaCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    empresa_id: str = Depends(obtener_empresa_id),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Crea una nueva tarea en el calendario.
      Valida permisos: operadores solo pueden crear para si mismos,
      supervisores pueden asignar a otros.
    DESCRIPCION TECNICA:
      FIX v1.0.2: usa INSERT con text() en lugar de ORM (db.add)
      para evitar NoReferencedTableError causado por tablas sin
      modelo ORM registrado en el metadata de SQLAlchemy
      (catalogo_tareas, rubros_tarea, servicios, clientes, etc).
      Genera UUID nuevo en Python. Retorna el dict de la tarea creada.
    """
    from sqlalchemy import text as sqlt
    import uuid as uuid_mod

    perfiles = await _obtener_perfiles(usuario_actual.id, db)

    # Validar permisos de asignacion
    if str(datos.asignado_a_id) != str(usuario_actual.id):
        if "supervisor" not in perfiles and "dueno" not in perfiles \
           and "administrador" not in perfiles:
            raise HTTPException(
                status_code=403,
                detail="Solo supervisores pueden asignar tareas a otros usuarios"
            )
        tipo_creacion = "supervisor"
    else:
        tipo_creacion = "operador"

    if not datos.catalogo_tarea_id and not datos.nombre_personalizado:
        raise HTTPException(400, "Debe especificar una tarea del catálogo o un nombre personalizado")

    # Generar nuevo UUID para la tarea
    nuevo_id = str(uuid_mod.uuid4())

    # INSERT con SQL directo — evita el problema de metadata de SQLAlchemy
    await db.execute(sqlt("""
        INSERT INTO tareas (
            id, catalogo_tarea_id, nombre_personalizado, descripcion,
            rubro_id, asignado_a_id, cliente_id, servicio_id,
            fecha_planificada, fecha_vencimiento, sla_horas, prioridad, estado,
            creada_por_id, tipo_creacion, comentario_supervisor,
            empresa_id, es_heredada, activa, creado_en
        ) VALUES (
            :id, :catalogo_tarea_id, :nombre_personalizado, :descripcion,
            :rubro_id, :asignado_a_id, :cliente_id, :servicio_id,
            :fecha_planificada, :fecha_vencimiento, :sla_horas, :prioridad, 'pendiente',
            :creada_por_id, :tipo_creacion, :comentario_supervisor,
            :empresa_id, FALSE, TRUE, NOW()
        )
    """), {
        "id":                   nuevo_id,
        "catalogo_tarea_id":    str(datos.catalogo_tarea_id)   if datos.catalogo_tarea_id   else None,
        "nombre_personalizado": datos.nombre_personalizado,
        "descripcion":          datos.descripcion,
        "rubro_id":             str(datos.rubro_id)            if datos.rubro_id            else None,
        "asignado_a_id":        str(datos.asignado_a_id),
        "cliente_id":           str(datos.cliente_id)          if datos.cliente_id          else None,
        "servicio_id":          str(datos.servicio_id)         if datos.servicio_id         else None,
        "fecha_planificada":    datos.fecha_planificada,
        "fecha_vencimiento":    datos.fecha_vencimiento,
        "sla_horas":           datos.sla_horas,
        "prioridad":            datos.prioridad,
        "creada_por_id":        str(usuario_actual.id),
        "tipo_creacion":        tipo_creacion,
        "comentario_supervisor": datos.comentario_supervisor,
        "empresa_id":            empresa_id,
    })

    await db.flush()

    await registrar_auditoria(
        db, "tareas", nuevo_id, "INSERT",
        usuario_id=str(usuario_actual.id)
    )

    # Si la tarea es compleja, instanciar el seguimiento de etapas
    if datos.catalogo_tarea_id:
        from app.api.tareas_complejas import instanciar_ejecucion_compleja
        ct_row = await db.execute(sqlt(
            'SELECT es_compleja FROM catalogo_tareas WHERE id = :id'
        ), {'id': str(datos.catalogo_tarea_id)})
        ct_data = ct_row.fetchone()
        if ct_data and ct_data.es_compleja:
            await instanciar_ejecucion_compleja(
                tarea_id          = nuevo_id,
                catalogo_tarea_id = str(datos.catalogo_tarea_id),
                asignado_a_id     = str(datos.asignado_a_id),
                db                = db
            )

    return {
        "id":               nuevo_id,
        "estado":           "pendiente",
        "prioridad":        datos.prioridad,
        "fecha_planificada": datos.fecha_planificada.isoformat() if datos.fecha_planificada else None,
        "mensaje":          "Tarea creada correctamente",
    }



@router.get("/para-widget")
async def tareas_para_widget(
    fecha:          Optional[date] = Query(default=None),
    usuario_actual: Usuario        = Depends(obtener_usuario_actual),
    empresa_id:    str             = Depends(obtener_empresa_id),
    db: AsyncSession               = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Endpoint para el widget Windows.
      Tareas simples: igual que listar_tareas.
      Tareas complejas: devuelve cada etapa asignada al usuario
      como un ítem independiente con contexto de la tarea global.
    """
    from sqlalchemy import text as sqlt

    if fecha is None:
        fecha = date.today()
    uid = str(usuario_actual.id)
    # Filtro de empresa
    filtro_empresa_sql    = "AND t.empresa_id = :empresa_id" if empresa_id else ""
    filtro_empresa_params = {"empresa_id": empresa_id} if empresa_id else {}

    # Tareas simples — incluye JOIN con etapas para detectar tareas de validación supervisor
    r1 = await db.execute(sqlt("""
        SELECT t.id, t.estado, t.prioridad, t.fecha_planificada,
               t.inicio_real, t.fin_real, t.tiempo_trabajado_minutos,
               t.es_heredada, t.comentario_supervisor, t.comentario_operador,
               t.asignado_a_id,
               COALESCE(ct.nombre, t.nombre_personalizado, 'Sin nombre') AS tarea_nombre,
               COALESCE(ct.codigo, '') AS tarea_codigo,
               c.razon_social AS cliente_nombre,
               s.nombre       AS servicio_nombre,
               -- Etapa vinculada si esta tarea es una validación de supervisor
               te_val.id AS etapa_id_validacion
        FROM tareas t
        LEFT JOIN catalogo_tareas ct ON t.catalogo_tarea_id = ct.id
        LEFT JOIN clientes c         ON t.cliente_id        = c.id
        LEFT JOIN servicios s        ON t.servicio_id       = s.id
        -- Busca si esta tarea es la tarea de validación de alguna etapa compleja
        LEFT JOIN tarea_compleja_etapas te_val ON te_val.tarea_validacion_id = t.id
                                              AND te_val.activo = TRUE
        WHERE t.activa = TRUE AND t.fecha_planificada = :fecha
          AND t.asignado_a_id = :uid
          AND (t.es_tarea_compleja = FALSE OR t.es_tarea_compleja IS NULL)
        ORDER BY CASE t.estado
            WHEN 'en_curso' THEN 0 WHEN 'pendiente' THEN 1
            WHEN 'pausada'  THEN 2 WHEN 'completada' THEN 3 ELSE 4 END,
            CASE t.prioridad
            WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1
            WHEN 'media'   THEN 2 WHEN 'baja' THEN 3 ELSE 4 END
    """), {"fecha": fecha, "uid": uid})

    items = [{"tipo":"tarea_simple","id":str(r.id),
        "tarea_nombre":r.tarea_nombre,"tarea_codigo":r.tarea_codigo,
        "estado":r.estado,"prioridad":r.prioridad,
        "fecha_planificada":r.fecha_planificada.isoformat() if r.fecha_planificada else None,
        "inicio_real":r.inicio_real.isoformat() if r.inicio_real else None,
        "fin_real":r.fin_real.isoformat() if r.fin_real else None,
        "tiempo_trabajado_minutos":r.tiempo_trabajado_minutos,
        "es_heredada":r.es_heredada,
        "comentario_supervisor":r.comentario_supervisor,
        "comentario_operador":r.comentario_operador,
        "asignado_a_id":str(r.asignado_a_id),
        "cliente_nombre":r.cliente_nombre,"servicio_nombre":r.servicio_nombre,
        # ID de la etapa a validar (solo para tareas de validación supervisor)
        "etapa_id_validacion": str(r.etapa_id_validacion) if r.etapa_id_validacion else None,
    } for r in r1.fetchall()]

    # Etapas de tareas complejas
    r2 = await db.execute(sqlt("""
        SELECT te.id AS etapa_id, te.asignado_a_id AS asignado_etapa_id, te.orden AS etapa_orden, te.nombre AS etapa_nombre,
               te.estado AS etapa_estado, te.inicio_real, te.fin_real,
               te.tiempo_trabajado_minutos, te.requiere_validacion,
               te.sla_validacion_horas, te.vencimiento_sla, te.comentario_operador,
               te.requiere_correccion, te.comentario_validacion, te.historial_rechazos,
               ex.etapa_actual_orden,
               (SELECT COUNT(*) FROM tarea_compleja_etapas te2
                WHERE te2.ejecucion_id = ex.id AND te2.activo = TRUE) AS total_etapas,
               t.id AS tarea_id, t.prioridad, t.es_heredada, t.fecha_planificada,
               t.comentario_supervisor,
               COALESCE(ct.nombre, t.nombre_personalizado, 'Sin nombre') AS tarea_nombre,
               COALESCE(ct.codigo, '') AS tarea_codigo,
               c.razon_social AS cliente_nombre, s.nombre AS servicio_nombre
        FROM tarea_compleja_etapas te
        JOIN tarea_compleja_ejecucion ex ON te.ejecucion_id    = ex.id
        JOIN tareas t                    ON ex.tarea_id         = t.id
        LEFT JOIN catalogo_tareas ct     ON t.catalogo_tarea_id = ct.id
        LEFT JOIN clientes c             ON t.cliente_id        = c.id
        LEFT JOIN servicios s            ON t.servicio_id       = s.id
        WHERE te.asignado_a_id = :uid AND te.activo = TRUE
          AND t.activa = TRUE AND t.fecha_planificada = :fecha
          AND te.estado NOT IN ('bloqueada', 'completada')
        ORDER BY CASE te.estado
            WHEN 'en_curso'             THEN 0
            WHEN 'validacion_pendiente' THEN 1
            WHEN 'pendiente'            THEN 2 ELSE 3 END, te.orden
    """), {"fecha": fecha, "uid": uid})

    for r in r2.fetchall():
        items.append({"tipo":"etapa_compleja","id":str(r.etapa_id),
            "tarea_id":str(r.tarea_id),"tarea_nombre":r.tarea_nombre,
            "tarea_codigo":r.tarea_codigo,"etapa_nombre":r.etapa_nombre,
            "etapa_orden":r.etapa_orden,"etapa_actual_orden":r.etapa_actual_orden,
            "total_etapas":r.total_etapas,"estado":r.etapa_estado,
            "asignado_a_id":str(r.asignado_etapa_id) if r.asignado_etapa_id else None,
            "prioridad":r.prioridad,"es_heredada":r.es_heredada,
            "fecha_planificada":r.fecha_planificada.isoformat() if r.fecha_planificada else None,
            "inicio_real":r.inicio_real.isoformat() if r.inicio_real else None,
            "fin_real":r.fin_real.isoformat() if r.fin_real else None,
            "tiempo_trabajado_minutos":r.tiempo_trabajado_minutos,
            "requiere_validacion":    r.requiere_validacion,
            "requiere_correccion":    r.requiere_correccion,
            "comentario_validacion":  r.comentario_validacion,
            "historial_rechazos":     r.historial_rechazos,
            "sla_validacion_horas":r.sla_validacion_horas,
            "vencimiento_sla":r.vencimiento_sla.isoformat() if r.vencimiento_sla else None,
            "comentario_supervisor":r.comentario_supervisor,
            "comentario_operador":r.comentario_operador,
            "cliente_nombre":r.cliente_nombre,"servicio_nombre":r.servicio_nombre,
        })

    return items

@router.get("/para-jornada")
async def tareas_para_jornada(
    fecha:          Optional[date] = Query(default=None),
    usuario_id:     Optional[str]  = Query(default=None,
        description="ID de usuario a consultar (solo supervisores pueden ver otros)"),
    usuario_actual: Usuario        = Depends(obtener_usuario_actual),
    db: AsyncSession               = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Endpoint para Mi Jornada en browser y widget Windows.
      Incluye TODAS las etapas (completadas con actividad).
      Agrega nombre del validador para etapas en validacion_pendiente.
      v1.1.0: acepta usuario_id para que supervisores vean la jornada
      de un operador específico o la propia.
    """
    from sqlalchemy import text as sqlt

    if fecha is None:
        fecha = date.today()

    # Verificar permisos si se pide la jornada de otro usuario
    if usuario_id and str(usuario_id) != str(usuario_actual.id):
        perfiles = await _obtener_perfiles(usuario_actual.id, db)
        es_sup = "supervisor" in perfiles or "dueno" in perfiles or "administrador" in perfiles
        if not es_sup:
            raise HTTPException(403, "Solo supervisores pueden ver la jornada de otro usuario")

    uid = str(usuario_id) if usuario_id else str(usuario_actual.id)

    # Tareas simples — incluye completadas
    r1 = await db.execute(sqlt("""
        SELECT t.id, t.estado, t.prioridad, t.fecha_planificada,
               t.inicio_real, t.fin_real, t.tiempo_trabajado_minutos,
               t.es_heredada, t.comentario_supervisor, t.comentario_operador,
               t.asignado_a_id,
               COALESCE(ct.nombre, t.nombre_personalizado, 'Sin nombre') AS tarea_nombre,
               COALESCE(ct.codigo, '') AS tarea_codigo,
               c.razon_social AS cliente_nombre,
               s.nombre       AS servicio_nombre
        FROM tareas t
        LEFT JOIN catalogo_tareas ct ON t.catalogo_tarea_id = ct.id
        LEFT JOIN clientes c         ON t.cliente_id        = c.id
        LEFT JOIN servicios s        ON t.servicio_id       = s.id
        WHERE t.activa = TRUE AND t.fecha_planificada = :fecha
          AND t.asignado_a_id = :uid
          AND (t.es_tarea_compleja = FALSE OR t.es_tarea_compleja IS NULL)
        ORDER BY t.inicio_real NULLS LAST, t.fin_real NULLS LAST
    """), {"fecha": fecha, "uid": uid})

    items = [{"tipo":"tarea_simple","id":str(r.id),
        "tarea_nombre":r.tarea_nombre,"tarea_codigo":r.tarea_codigo,
        "estado":r.estado,"prioridad":r.prioridad,
        "fecha_planificada":r.fecha_planificada.isoformat() if r.fecha_planificada else None,
        "inicio_real":r.inicio_real.isoformat() if r.inicio_real else None,
        "fin_real":r.fin_real.isoformat() if r.fin_real else None,
        "tiempo_trabajado_minutos":r.tiempo_trabajado_minutos,
        "es_heredada":r.es_heredada,
        "comentario_supervisor":r.comentario_supervisor,
        "comentario_operador":r.comentario_operador,
        "asignado_a_id":str(r.asignado_a_id),
        "cliente_nombre":r.cliente_nombre,"servicio_nombre":r.servicio_nombre,
    } for r in r1.fetchall()]

    # Etapas de tareas complejas — incluye completadas
    r2 = await db.execute(sqlt("""
        SELECT te.id AS etapa_id, te.asignado_a_id AS asignado_etapa_id,
               te.orden AS etapa_orden, te.nombre AS etapa_nombre,
               te.estado AS etapa_estado, te.inicio_real, te.fin_real,
               te.tiempo_trabajado_minutos, te.requiere_validacion,
               te.sla_validacion_horas, te.vencimiento_sla,
               te.comentario_operador, te.requiere_correccion,
               te.comentario_validacion, te.historial_rechazos,
               ex.etapa_actual_orden,
               (SELECT COUNT(*) FROM tarea_compleja_etapas te2
                WHERE te2.ejecucion_id = ex.id AND te2.activo = TRUE) AS total_etapas,
               t.id AS tarea_id, t.prioridad, t.es_heredada, t.fecha_planificada,
               t.comentario_supervisor,
               COALESCE(ct.nombre, t.nombre_personalizado, 'Sin nombre') AS tarea_nombre,
               COALESCE(ct.codigo, '') AS tarea_codigo,
               c.razon_social AS cliente_nombre, s.nombre AS servicio_nombre,
               -- Nombre del validador para etapas en validacion_pendiente
               (SELECT u.nombre || ' ' || u.apellido
                FROM supervisor_operador so
                JOIN usuarios u ON so.supervisor_id = u.id
                WHERE so.operador_id = te.asignado_a_id AND so.activo = TRUE
                LIMIT 1) AS validador_nombre
        FROM tarea_compleja_etapas te
        JOIN tarea_compleja_ejecucion ex ON te.ejecucion_id = ex.id
        JOIN tareas t                    ON ex.tarea_id = t.id
        LEFT JOIN catalogo_tareas ct     ON t.catalogo_tarea_id = ct.id
        LEFT JOIN clientes c             ON t.cliente_id = c.id
        LEFT JOIN servicios s            ON t.servicio_id = s.id
        WHERE te.asignado_a_id = :uid AND te.activo = TRUE
          AND t.activa = TRUE AND t.fecha_planificada = :fecha
          AND te.estado NOT IN ('bloqueada')
          AND te.inicio_real IS NOT NULL
        ORDER BY te.inicio_real NULLS LAST, te.orden
    """), {"fecha": fecha, "uid": uid})

    for r in r2.fetchall():
        items.append({"tipo":"etapa_compleja","id":str(r.etapa_id),
            "tarea_id":str(r.tarea_id),"tarea_nombre":r.tarea_nombre,
            "tarea_codigo":r.tarea_codigo,"etapa_nombre":r.etapa_nombre,
            "etapa_orden":r.etapa_orden,"etapa_actual_orden":r.etapa_actual_orden,
            "total_etapas":r.total_etapas,"estado":r.etapa_estado,
            "asignado_a_id":str(r.asignado_etapa_id) if r.asignado_etapa_id else None,
            "prioridad":r.prioridad,"es_heredada":r.es_heredada,
            "fecha_planificada":r.fecha_planificada.isoformat() if r.fecha_planificada else None,
            "inicio_real":r.inicio_real.isoformat() if r.inicio_real else None,
            "fin_real":r.fin_real.isoformat() if r.fin_real else None,
            "tiempo_trabajado_minutos":r.tiempo_trabajado_minutos,
            "requiere_validacion":   r.requiere_validacion,
            "requiere_correccion":   r.requiere_correccion,
            "comentario_validacion": r.comentario_validacion,
            "historial_rechazos":    r.historial_rechazos,
            "validador_nombre":      r.validador_nombre,
            "sla_validacion_horas":  r.sla_validacion_horas,
            "vencimiento_sla":       r.vencimiento_sla.isoformat() if r.vencimiento_sla else None,
            "comentario_supervisor": r.comentario_supervisor,
            "comentario_operador":   r.comentario_operador,
            "cliente_nombre":        r.cliente_nombre,
            "servicio_nombre":       r.servicio_nombre,
        })

    # Ordenar todo por inicio_real
    items.sort(key=lambda x: x.get("inicio_real") or "9999")
    return items
@router.get("/historial")
async def historial_tareas(
    fecha_desde: Optional[date] = Query(default=None),
    fecha_hasta: Optional[date] = Query(default=None),
    usuario_id:  Optional[str]  = Query(default=None),
    cliente_id:  Optional[str]  = Query(default=None),
    estado:      Optional[str]  = Query(default=None),
    usuario_actual: Usuario     = Depends(obtener_usuario_actual),
    db: AsyncSession             = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Retorna tareas de un rango de fechas con filtros opcionales.
      Operadores solo ven sus propias tareas.
      Supervisores pueden ver cualquier operador o todos.
    DESCRIPCION TECNICA:
      SQL directo con JOINs para nombres enriquecidos.
      Limita a 500 resultados para evitar sobrecarga.
      Ordenado por fecha_planificada DESC.
    """
    from sqlalchemy import text as sqlt
    from datetime import date as dt

    hoy = dt.today()
    if fecha_desde is None:
        fecha_desde = hoy.replace(day=1)
    if fecha_hasta is None:
        fecha_hasta = hoy

    perfiles      = await _obtener_perfiles(usuario_actual.id, db)
    es_supervisor = "supervisor" in perfiles or "dueno" in perfiles or "administrador" in perfiles

    filtros = ["t.activa = TRUE",
               "t.fecha_planificada BETWEEN :fi AND :ff"]
    params  = {"fi": fecha_desde, "ff": fecha_hasta}

    if not es_supervisor:
        filtros.append("t.asignado_a_id = :uid")
        params["uid"] = str(usuario_actual.id)
    elif usuario_id:
        filtros.append("t.asignado_a_id = :uid")
        params["uid"] = usuario_id

    if cliente_id:
        filtros.append("t.cliente_id = :cid")
        params["cid"] = cliente_id

    if estado:
        filtros.append("t.estado = :estado")
        params["estado"] = estado

    where = " AND ".join(filtros)

    result = await db.execute(sqlt(f"""
        SELECT
            t.id,
            t.fecha_planificada,
            t.estado,
            t.prioridad,
            t.tiempo_trabajado_minutos,
            t.es_heredada,
            t.tipo_creacion,
            t.comentario_supervisor,
            t.comentario_operador,
            t.inicio_real,
            t.fin_real,
            t.asignado_a_id,
            t.cliente_id,
            t.servicio_id,
            COALESCE(ct.nombre, t.nombre_personalizado, 'Sin nombre') AS tarea_nombre,
            COALESCE(ct.codigo, '')                                   AS tarea_codigo,
            u.nombre  || ' ' || u.apellido  AS operador_nombre,
            c.razon_social                  AS cliente_nombre,
            s.nombre                        AS servicio_nombre
        FROM tareas t
        JOIN  usuarios u      ON t.asignado_a_id      = u.id
        LEFT JOIN catalogo_tareas ct ON t.catalogo_tarea_id = ct.id
        LEFT JOIN clientes    c  ON t.cliente_id          = c.id
        LEFT JOIN servicios   s  ON t.servicio_id         = s.id
        WHERE {where}
        ORDER BY t.fecha_planificada DESC, t.creado_en DESC
        LIMIT 500
    """), params)

    return [
        {
            "id":                       str(r.id),
            "tarea_nombre":             r.tarea_nombre,
            "tarea_codigo":             r.tarea_codigo,
            "estado":                   r.estado,
            "prioridad":                r.prioridad,
            "fecha_planificada":        r.fecha_planificada.isoformat() if r.fecha_planificada else None,
            "tiempo_trabajado_minutos": r.tiempo_trabajado_minutos,
            "es_heredada":              r.es_heredada,
            "tipo_creacion":            r.tipo_creacion,
            "comentario_supervisor":    r.comentario_supervisor,
            "comentario_operador":      r.comentario_operador,
            "inicio_real":              r.inicio_real.isoformat() if r.inicio_real else None,
            "fin_real":                 r.fin_real.isoformat()    if r.fin_real    else None,
            "asignado_a_id":            str(r.asignado_a_id),
            "operador_nombre":          r.operador_nombre,
            "cliente_id":               str(r.cliente_id)    if r.cliente_id    else None,
            "cliente_nombre":           r.cliente_nombre,
            "servicio_id":              str(r.servicio_id)   if r.servicio_id   else None,
            "servicio_nombre":          r.servicio_nombre,
        }
        for r in result.fetchall()
    ]



@router.get("/{tarea_id}")
async def obtener_tarea(
    tarea_id: UUID4,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene el detalle de una tarea"""
    tarea = await _obtener_tarea_o_404(tarea_id, db)
    await _verificar_acceso_tarea(tarea, usuario_actual, db)
    return _tarea_a_dict(tarea)


"""
=============================================================
INSTRUCCION: en tareas.py reemplazar las 4 funciones de accion
(iniciar, pausar, reanudar, finalizar) por las de abajo.
Version del fix: v1.0.1
-------------------------------------------------------------
PROBLEMA: el ORM usa db.flush() que dispara el metadata de
SQLAlchemy e intenta resolver FKs de tablas sin modelo ORM
(catalogo_tareas, rubros_tarea, etc.) → NoReferencedTableError.

SOLUCION: reemplazar db.flush() por UPDATE con text() (SQL
directo). El SELECT del objeto Tarea sigue con ORM porque
solo lee — el problema ocurre solo al escribir (flush/commit).

APLICAR: localizar cada @router.post("/{tarea_id}/iniciar"),
/{tarea_id}/pausar, /{tarea_id}/reanudar, /{tarea_id}/finalizar
y reemplazar CADA funcion completa por la version de abajo.
=============================================================
"""


@router.post("/{tarea_id}/iniciar")
async def iniciar_tarea(
    tarea_id: UUID4,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL: PLAY — inicia una tarea pendiente.
    DESCRIPCION TECNICA: FIX v1.0.1 — UPDATE con text() para
      evitar NoReferencedTableError del ORM en el flush.
    """
    from sqlalchemy import text as sqlt

    tarea = await _obtener_tarea_o_404(tarea_id, db)

    if tarea.asignado_a_id != usuario_actual.id:
        raise HTTPException(403, "Solo podés iniciar tus propias tareas")
    if tarea.estado not in ("pendiente", "pausada"):
        raise HTTPException(400, f"No se puede iniciar una tarea en estado '{tarea.estado}'")

    ahora = datetime.now(TZ)

    if tarea.estado == "pendiente":
        # Primera vez: registrar inicio_real
        await db.execute(sqlt("""
            UPDATE tareas
            SET estado = 'en_curso', inicio_real = :ahora
            WHERE id = :id
        """), {"ahora": ahora, "id": str(tarea_id)})
    else:
        # Reanudar desde pausa: solo cambiar estado
        await db.execute(sqlt("""
            UPDATE tareas SET estado = 'en_curso'
            WHERE id = :id
        """), {"id": str(tarea_id)})

    return {"mensaje": "Tarea iniciada", "inicio": ahora.isoformat()}


@router.post("/{tarea_id}/pausar")
async def pausar_tarea(
    tarea_id: UUID4,
    datos: PausarTareaRequest,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL: PAUSA — pausa una tarea en curso.
    DESCRIPCION TECNICA: FIX v1.0.1 — INSERT de pausa y UPDATE
      de estado con text() para evitar NoReferencedTableError.
    """
    from sqlalchemy import text as sqlt
    import uuid as uuid_mod

    tarea = await _obtener_tarea_o_404(tarea_id, db)

    if tarea.asignado_a_id != usuario_actual.id:
        raise HTTPException(403, "Solo podés pausar tus propias tareas")
    if tarea.estado != "en_curso":
        raise HTTPException(400, f"No se puede pausar una tarea en estado '{tarea.estado}'")

    ahora = datetime.now(TZ)

    # Registrar la pausa con SQL directo
    await db.execute(sqlt("""
        INSERT INTO tarea_pausas (id, tarea_id, inicio_pausa, motivo, creado_en)
        VALUES (:id, :tarea_id, :inicio, :motivo, NOW())
    """), {
        "id":       str(uuid_mod.uuid4()),
        "tarea_id": str(tarea_id),
        "inicio":   ahora,
        "motivo":   datos.motivo,
    })

    # Actualizar estado con SQL directo
    await db.execute(sqlt("""
        UPDATE tareas SET estado = 'pausada' WHERE id = :id
    """), {"id": str(tarea_id)})

    return {"mensaje": "Tarea pausada"}


@router.post("/{tarea_id}/reanudar")
async def reanudar_tarea(
    tarea_id: UUID4,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL: PLAY desde PAUSA — reanuda una tarea.
    DESCRIPCION TECNICA: FIX v1.0.1 — cierra la pausa activa y
      actualiza estado con text() para evitar NoReferencedTableError.
    """
    from sqlalchemy import text as sqlt

    tarea = await _obtener_tarea_o_404(tarea_id, db)

    if tarea.asignado_a_id != usuario_actual.id:
        raise HTTPException(403, "Solo podés reanudar tus propias tareas")
    if tarea.estado != "pausada":
        raise HTTPException(400, "La tarea no está pausada")

    ahora = datetime.now(TZ)

    # Cerrar la pausa activa (fin_pausa = ahora, calcular duración)
    await db.execute(sqlt("""
        UPDATE tarea_pausas
        SET fin_pausa = :ahora,
            duracion_minutos = EXTRACT(EPOCH FROM (:ahora - inicio_pausa)) / 60
        WHERE tarea_id = :tid AND fin_pausa IS NULL
    """), {"ahora": ahora, "tid": str(tarea_id)})

    # Actualizar estado
    await db.execute(sqlt("""
        UPDATE tareas SET estado = 'en_curso' WHERE id = :id
    """), {"id": str(tarea_id)})

    return {"mensaje": "Tarea reanudada"}


@router.post("/{tarea_id}/finalizar")
async def finalizar_tarea(
    tarea_id: UUID4,
    datos: FinalizarTareaRequest,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      STOP — finaliza una tarea y calcula el tiempo total trabajado.
      REGLA: una tarea pausada NO puede finalizarse directamente.
      Debe reanudarse primero (para registrar el cierre de pausa)
      y luego finalizarse. Esto garantiza que el tiempo de pausa
      se contabilice correctamente.
    DESCRIPCION TECNICA:
      FIX v1.0.4: agrega validacion explícita de estado 'pausada'.
      Solo acepta estado 'en_curso' para finalizar.
      Todos los UPDATE usan text() para evitar NoReferencedTableError.
    """
    from sqlalchemy import text as sqlt
 
    tarea = await _obtener_tarea_o_404(tarea_id, db)
 
    if tarea.asignado_a_id != usuario_actual.id:
        raise HTTPException(403, "Solo podés finalizar tus propias tareas")
 
    # VALIDACION CRITICA: pausada no puede finalizarse directamente
    if tarea.estado == "pausada":
        raise HTTPException(
            400,
            "La tarea está pausada. Reanudala primero con ▶ Reanudar "
            "y luego finalizala."
        )
 
    if tarea.estado != "en_curso":
        raise HTTPException(
            400,
            f"No se puede finalizar una tarea en estado '{tarea.estado}'. "
            "Solo se pueden finalizar tareas en curso."
        )
 
    ahora = datetime.now(TZ)
 
    # Cerrar pausa activa si existe (por seguridad, aunque no deberia haber)
    await db.execute(sqlt("""
        UPDATE tarea_pausas
        SET fin_pausa = :ahora,
            duracion_minutos = GREATEST(0,
                EXTRACT(EPOCH FROM (:ahora - inicio_pausa)) / 60
            )
        WHERE tarea_id = :tid AND fin_pausa IS NULL
    """), {"ahora": ahora, "tid": str(tarea_id)})
 
    # Calcular minutos totales de pausas
    result = await db.execute(sqlt("""
        SELECT COALESCE(SUM(duracion_minutos), 0) AS total_pausa
        FROM tarea_pausas WHERE tarea_id = :tid
    """), {"tid": str(tarea_id)})
    minutos_pausa = int(result.fetchone().total_pausa or 0)
 
    # Calcular tiempo total trabajado (bruto - pausas)
    inicio = tarea.inicio_real
    tiempo_total = 0
    if inicio:
        tiempo_total = max(
            0,
            int((ahora - inicio).total_seconds() / 60) - minutos_pausa
        )
 
    # Actualizar la tarea
    await db.execute(sqlt("""
        UPDATE tareas SET
            estado = 'completada',
            fin_real = :ahora,
            tiempo_trabajado_minutos = :tiempo,
            comentario_operador = COALESCE(:comentario, comentario_operador)
        WHERE id = :id
    """), {
        "ahora":      ahora,
        "tiempo":     tiempo_total,
        "comentario": datos.comentario_operador,
        "id":         str(tarea_id),
    })
 
    return {
        "mensaje":                  "Tarea completada",
        "fin":                      ahora.isoformat(),
        "tiempo_trabajado_minutos": tiempo_total,
    }

@router.put("/{tarea_id}")
async def actualizar_tarea(
    tarea_id: UUID4,
    datos: TareaActualizar,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Actualiza datos de una tarea (con validación de permisos)"""
    tarea = await _obtener_tarea_o_404(tarea_id, db)
    perfiles = await _obtener_perfiles(usuario_actual.id, db)
    
    es_supervisor = "supervisor" in perfiles or "dueno" in perfiles or "administrador" in perfiles
    es_propia = tarea.asignado_a_id == usuario_actual.id
    fue_creada_por_supervisor = tarea.tipo_creacion == "supervisor"
    
    if not es_supervisor and fue_creada_por_supervisor and not es_propia:
        raise HTTPException(403, "No tenés permisos para modificar esta tarea")
    
    campos_modificados = []
    if datos.descripcion is not None:
        tarea.descripcion = datos.descripcion
        campos_modificados.append("descripcion")
    if datos.fecha_planificada is not None and es_supervisor:
        tarea.fecha_planificada = datos.fecha_planificada
        campos_modificados.append("fecha_planificada")
    if datos.prioridad is not None and es_supervisor:
        tarea.prioridad = datos.prioridad
        campos_modificados.append("prioridad")
    if datos.comentario_supervisor is not None and es_supervisor:
        tarea.comentario_supervisor = datos.comentario_supervisor
        campos_modificados.append("comentario_supervisor")
    if datos.comentario_operador is not None and es_propia:
        tarea.comentario_operador = datos.comentario_operador
        campos_modificados.append("comentario_operador")
    
    tarea.actualizado_por = usuario_actual.id
    await db.flush()
    
    return {"mensaje": "Tarea actualizada", "campos_modificados": campos_modificados}


@router.delete("/{tarea_id}")
async def eliminar_tarea(
    tarea_id: UUID4,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Elimina logicamente una tarea (activa = FALSE).
      Operadores solo pueden eliminar sus propias tareas que
      ellos mismos crearon y que esten en estado pendiente.
    DESCRIPCION TECNICA:
      FIX v1.0.4: usa UPDATE con text() para evitar
      NoReferencedTableError del ORM al hacer flush.
    """
    from sqlalchemy import text as sqlt
 
    tarea = await _obtener_tarea_o_404(tarea_id, db)
    perfiles      = await _obtener_perfiles(usuario_actual.id, db)
    es_supervisor = "supervisor" in perfiles or "dueno" in perfiles \
                    or "administrador" in perfiles
    es_propia     = tarea.asignado_a_id == usuario_actual.id
    creada_por_el = str(tarea.creada_por_id) == str(usuario_actual.id)
 
    if not es_supervisor:
        if not (es_propia and creada_por_el and tarea.tipo_creacion == "operador"):
            raise HTTPException(
                403,
                "Solo podés eliminar las tareas que vos mismo creaste para vos"
            )
 
    # UPDATE con SQL directo — evita NoReferencedTableError del ORM
    await db.execute(sqlt("""
        UPDATE tareas SET activa = FALSE WHERE id = :id
    """), {"id": str(tarea_id)})
 
    await registrar_auditoria(
        db, "tareas", str(tarea_id), "DELETE",
        usuario_id=str(usuario_actual.id)
    )
 
    return {"mensaje": "Tarea eliminada"}


@router.get("/{tarea_id}/pausas")
async def obtener_pausas_tarea(
    tarea_id: UUID4,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Lista todas las pausas de una tarea"""
    result = await db.execute(
        select(TareaPausa).where(TareaPausa.tarea_id == tarea_id)
        .order_by(TareaPausa.inicio_pausa)
    )
    pausas = result.scalars().all()
    
    return [
        {
            "id": str(p.id),
            "inicio": p.inicio_pausa.isoformat() if p.inicio_pausa else None,
            "fin": p.fin_pausa.isoformat() if p.fin_pausa else None,
            "motivo": p.motivo,
            "duracion_minutos": p.duracion_minutos,
        }
        for p in pausas
    ]


@router.post("/{tarea_id}/comentarios")
async def agregar_comentario(
    tarea_id: UUID4,
    datos: ComentarioRequest,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Agrega un comentario a una tarea"""
    tarea = await _obtener_tarea_o_404(tarea_id, db)
    
    comentario = TareaComentario(
        tarea_id=tarea.id,
        usuario_id=usuario_actual.id,
        tipo=datos.tipo,
        comentario=datos.comentario,
    )
    db.add(comentario)
    await db.flush()
    
    return {"mensaje": "Comentario agregado", "id": str(comentario.id)}


@router.post("/heredar")
async def heredar_tareas(
    fecha: date = Query(default=None),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    Hereda las tareas incompletas al siguiente día hábil.
    Solo admins/dueños pueden ejecutar esto manualmente.
    Normalmente se ejecuta automáticamente por un job nocturno.
    """
    perfiles = await _obtener_perfiles(usuario_actual.id, db)
    if "administrador" not in perfiles and "dueno" not in perfiles:
        raise HTTPException(403, "Solo administradores pueden ejecutar la herencia manualmente")
    
    if fecha is None:
        fecha = date.today()
    
    # Llamar a la función SQL
    result = await db.execute(
        f"SELECT heredar_tareas_del_dia('{fecha}'::DATE)"
    )
    cantidad = result.scalar()
    
    return {"mensaje": f"Se heredaron {cantidad} tareas al día siguiente"}



@router.get("/agenda/mes")
async def agenda_mes(
    anio: int = Query(..., description="Año del mes a consultar"),
    mes:  int = Query(..., description="Mes (1-12)"),
    usuario_id: Optional[str] = Query(default=None, description="Filtrar por operador"),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Retorna todas las tareas del mes indicado agrupadas por dia.
      Incluye nombre del operador, cliente, servicio y tarea del catalogo.
      Los supervisores pueden ver todos los operadores o filtrar por uno.
      Los operadores solo ven sus propias tareas.
    DESCRIPCION TECNICA:
      JOIN con usuarios, clientes, servicios y catalogo_tareas.
      Agrupa el resultado en un dict {fecha_iso: [tareas]} para
      que el frontend arme la grilla del calendario directamente.
    """
    from sqlalchemy import text as sqlt

    # Calcular primer y ultimo dia del mes
    _, ultimo_dia = cal_module.monthrange(anio, mes)
    fecha_ini = date(anio, mes, 1)
    fecha_fin = date(anio, mes, ultimo_dia)

    # Determinar perfiles del usuario actual
    perfiles = await _obtener_perfiles(usuario_actual.id, db)
    es_supervisor = "supervisor" in perfiles or "dueno" in perfiles or "administrador" in perfiles

    # Construir filtro de usuario
    params = {"fi": fecha_ini, "ff": fecha_fin}
    filtro_usuario = ""
    if not es_supervisor:
        # Operadores solo ven sus propias tareas
        filtro_usuario = "AND t.asignado_a_id = :uid"
        params["uid"] = str(usuario_actual.id)
    elif usuario_id:
        # Supervisor filtrando por operador especifico
        filtro_usuario = "AND t.asignado_a_id = :uid"
        params["uid"] = usuario_id

    result = await db.execute(sqlt(f"""
        SELECT
            t.id,
            t.fecha_planificada,
            t.estado,
            t.prioridad,
            t.tipo_creacion,
            t.es_heredada,
            t.tiempo_trabajado_minutos,
            t.comentario_supervisor,
            t.comentario_operador,
            -- Nombre de la tarea: catalogo o personalizado
            COALESCE(ct.nombre, t.nombre_personalizado, 'Sin nombre') AS tarea_nombre,
            COALESCE(ct.codigo, '')                                   AS tarea_codigo,
            -- Operador asignado
            u.nombre  || ' ' || u.apellido AS operador_nombre,
            u.id                           AS operador_id,
            -- Cliente (opcional)
            c.razon_social  AS cliente_nombre,
            c.id            AS cliente_id,
            -- Servicio (opcional)
            s.nombre        AS servicio_nombre,
            s.id            AS servicio_id,
            -- Rubro
            rt.nombre       AS rubro_nombre,
            rt.color_hex    AS rubro_color
        FROM tareas t
        JOIN  usuarios u     ON t.asignado_a_id      = u.id
        LEFT JOIN catalogo_tareas ct ON t.catalogo_tarea_id = ct.id
        LEFT JOIN clientes    c  ON t.cliente_id          = c.id
        LEFT JOIN servicios   s  ON t.servicio_id         = s.id
        LEFT JOIN rubros_tarea rt ON t.rubro_id           = rt.id
        WHERE t.activa = TRUE
          AND t.fecha_planificada BETWEEN :fi AND :ff
          {filtro_usuario}
        ORDER BY t.fecha_planificada, t.prioridad DESC, t.creado_en
    """), params)

    rows = result.fetchall()

    # Agrupar por fecha para que el frontend arme la grilla
    por_dia = {}
    for r in rows:
        clave = r.fecha_planificada.isoformat()
        if clave not in por_dia:
            por_dia[clave] = []
        por_dia[clave].append({
            "id":                        str(r.id),
            "tarea_nombre":              r.tarea_nombre,
            "tarea_codigo":              r.tarea_codigo,
            "estado":                    r.estado,
            "prioridad":                 r.prioridad,
            "tipo_creacion":             r.tipo_creacion,
            "es_heredada":               r.es_heredada,
            "tiempo_trabajado_minutos":  r.tiempo_trabajado_minutos,
            "operador_nombre":           r.operador_nombre,
            "operador_id":               str(r.operador_id),
            "cliente_nombre":            r.cliente_nombre,
            "cliente_id":                str(r.cliente_id) if r.cliente_id else None,
            "servicio_nombre":           r.servicio_nombre,
            "servicio_id":               str(r.servicio_id) if r.servicio_id else None,
            "rubro_nombre":              r.rubro_nombre,
            "rubro_color":               r.rubro_color,
            "comentario_supervisor":     r.comentario_supervisor,
            "comentario_operador":       r.comentario_operador,
        })

    return {
        "anio":    anio,
        "mes":     mes,
        "por_dia": por_dia,  # { "2026-06-01": [...tareas], "2026-06-02": [...] }
    }


# =============================================================================
# ENDPOINT: GET /agenda/sugerencias
# Calcula tareas sugeridas para el mes desde servicios activos
# NOTA: debe declararse ANTES de /{tarea_id} en tareas.py
# =============================================================================

"""
=============================================================
INSTRUCCION: en tareas.py reemplazar el endpoint
  GET /agenda/sugerencias
  
Localizar el decorador:
  @router.get("/agenda/sugerencias")
  async def agenda_sugerencias(...)

Reemplazar TODA esa funcion (hasta el proximo @router o def)
por el codigo de abajo.

Fix: filtra las sugerencias ya asignadas en el mes.
Una sugerencia se considera "ya asignada" si existe en la BD
una tarea activa para el mismo cliente_id + catalogo_tarea_id
en el mismo mes/anio, independientemente del dia exacto.
Versión del fix: v1.0.1
=============================================================
"""

@router.get("/agenda/sugerencias")
async def agenda_sugerencias(
    anio:       int           = Query(...),
    mes:        int           = Query(...),
    cliente_id: Optional[str] = Query(default=None),
    usuario_actual: Usuario   = Depends(obtener_usuario_actual),
    db: AsyncSession          = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Calcula las tareas que deberian generarse en el mes indicado
      segun las reglas de calendarizacion de los servicios activos.
      FIX v1.0.1: excluye las sugerencias que ya tienen una tarea
      creada en la BD para el mismo cliente + catalogo_tarea en
      el mismo mes. Evita duplicados en la asignacion masiva.
    DESCRIPCION TECNICA:
      1. Carga dias habiles del mes (excluye fines de semana y feriados).
      2. Carga servicios activos con sus reglas de calendarizacion.
      3. Aplica cada regla para calcular la fecha sugerida.
      4. Consulta tareas ya existentes en la BD para ese mes
         agrupadas por (cliente_id, catalogo_tarea_id).
      5. Filtra las sugerencias cuya combinacion ya existe.
    """
    from sqlalchemy import text as sqlt

    # ── Paso 1: dias habiles del mes ─────────────────────────────
    _, ultimo_dia = cal_module.monthrange(anio, mes)
    result_feriados = await db.execute(sqlt("""
        SELECT fecha FROM feriados WHERE anio = :anio AND activo = TRUE
    """), {"anio": anio})
    feriados    = {r.fecha for r in result_feriados.fetchall()}
    todos_dias  = [date(anio, mes, d) for d in range(1, ultimo_dia + 1)]
    habiles     = [d for d in todos_dias if d.weekday() < 5 and d not in feriados]
    fecha_ini   = date(anio, mes, 1)
    fecha_fin   = date(anio, mes, ultimo_dia)

    # ── Paso 2: tareas ya existentes en el mes ───────────────────
    # Clave de deduplicacion: cliente_id + catalogo_tarea_id
    # Si ya existe una tarea activa para ese par en el mes, no sugerir.
    result_existentes = await db.execute(sqlt("""
        SELECT DISTINCT
            t.cliente_id::TEXT,
            t.catalogo_tarea_id::TEXT
        FROM tareas t
        WHERE t.activa = TRUE
          AND t.fecha_planificada BETWEEN :fi AND :ff
          AND t.catalogo_tarea_id IS NOT NULL
          AND t.cliente_id IS NOT NULL
    """), {"fi": fecha_ini, "ff": fecha_fin})
    ya_asignadas = {
        (str(r.cliente_id), str(r.catalogo_tarea_id))
        for r in result_existentes.fetchall()
    }

    # ── Paso 3: servicios y sus tareas automaticas ───────────────
    filtro_cliente = ""
    params = {"hoy": date.today()}
    if cliente_id:
        filtro_cliente = "AND cs.cliente_id = :cliente_id"
        params["cliente_id"] = cliente_id

    result = await db.execute(sqlt(f"""
        SELECT
            st.id              AS servicio_tarea_id,
            st.tipo_calendarizacion,
            st.regla_tipo,
            st.regla_valor_n,
            st.ref_tipo,
            st.ref_valor,
            st.duracion_estimada_minutos,
            st.es_obligatoria,
            st.orden,
            st.meses_activos,
            ct.id              AS catalogo_tarea_id,
            ct.nombre          AS tarea_nombre,
            ct.codigo          AS tarea_codigo,
            ct.rubro_id,
            s.id               AS servicio_id,
            s.nombre           AS servicio_nombre,
            c.id               AS cliente_id,
            c.razon_social     AS cliente_nombre
        FROM cliente_servicios cs
        JOIN servicios s       ON cs.servicio_id       = s.id  AND s.activo = TRUE
        JOIN servicio_tareas st ON st.servicio_id      = s.id  AND st.activo = TRUE
        JOIN catalogo_tareas ct ON st.catalogo_tarea_id = ct.id AND ct.activo = TRUE
        JOIN clientes c        ON cs.cliente_id        = c.id  AND c.activo = TRUE
        WHERE cs.activo = TRUE
          AND st.tipo_calendarizacion = 'automatica'
          AND (cs.fecha_fin IS NULL OR cs.fecha_fin >= :hoy)
          {filtro_cliente}
        ORDER BY c.razon_social, s.nombre, st.orden
    """), params)
    reglas = result.fetchall()

    # ── Paso 4: calcular fecha sugerida y filtrar ya asignadas ────
    sugerencias = []
    for r in reglas:
        # Verificar si ya existe tarea para este cliente + catalogo en el mes
        clave = (str(r.cliente_id), str(r.catalogo_tarea_id))
        if clave in ya_asignadas:
            continue   # Ya asignada — no sugerir

        # Filtrar por meses_activos: si está definido, el mes actual debe estar en la lista
        if r.meses_activos:
            meses_permitidos = [int(m) for m in r.meses_activos.split(",") if m.strip().isdigit()]
            if mes not in meses_permitidos:
                continue   # Este mes no está habilitado para esta tarea

        fecha_sugerida = _calcular_fecha_sugerida(
            regla_tipo    = r.regla_tipo,
            regla_valor_n = r.regla_valor_n,
            ref_tipo      = r.ref_tipo,
            ref_valor     = r.ref_valor,
            habiles       = habiles,
            todos         = todos_dias,
        )
        if fecha_sugerida is None:
            continue

        sugerencias.append({
            "servicio_tarea_id":         str(r.servicio_tarea_id),
            "catalogo_tarea_id":         str(r.catalogo_tarea_id),
            "tarea_nombre":              r.tarea_nombre,
            "tarea_codigo":              r.tarea_codigo,
            "rubro_id":                  str(r.rubro_id) if r.rubro_id else None,
            "servicio_id":               str(r.servicio_id),
            "servicio_nombre":           r.servicio_nombre,
            "cliente_id":                str(r.cliente_id),
            "cliente_nombre":            r.cliente_nombre,
            "fecha_sugerida":            fecha_sugerida.isoformat(),
            "regla_tipo":                r.regla_tipo,
            "regla_valor_n":             r.regla_valor_n,
            "duracion_estimada_minutos": r.duracion_estimada_minutos,
            "es_obligatoria":            r.es_obligatoria,
            "orden":                     r.orden,
        })

    sugerencias.sort(key=lambda x: x["fecha_sugerida"])

    return {
        "anio":        anio,
        "mes":         mes,
        "dias_habiles": len(habiles),
        "ya_asignadas": len(ya_asignadas),  # Info para debugging
        "sugerencias": sugerencias,
    }


def _calcular_fecha_sugerida(
    regla_tipo: str,
    regla_valor_n: int,
    ref_tipo: str,
    ref_valor: int,
    habiles: list,
    todos: list,
) -> date:
    """
    DESCRIPCION FUNCIONAL:
      Aplica una regla de calendarizacion sobre los dias habiles/corridos
      del mes y retorna la fecha calculada, o None si no aplica.
    DESCRIPCION TECNICA:
      Implementa las mismas 11 reglas definidas en REGLAS del frontend.
      habiles: lista de dates de dias habiles del mes.
      todos:   lista de todas las dates del mes.
    """
    if not habiles:
        return None

    # ── fecha_fija_mes: dia corrido N del mes ──────────────────────────────
    if regla_tipo == "fecha_fija_mes":
        n = regla_valor_n or 1
        # Buscar el dia corrido N (puede no ser habil, se acepta igual)
        candidatos = [d for d in todos if d.day == n]
        return candidatos[0] if candidatos else todos[-1]

    # ── dia_habil_n: el N-esimo dia habil del mes ─────────────────────────
    if regla_tipo == "dia_habil_n":
        n = regla_valor_n or 1
        idx = n - 1   # Indice 0-based
        return habiles[idx] if idx < len(habiles) else habiles[-1]

    # ── dias_habiles_despues: N dias habiles despues de una fecha ref ──────
    if regla_tipo == "dias_habiles_despues":
        fecha_ref = _calcular_fecha_referencia(ref_tipo, ref_valor, habiles, todos)
        if fecha_ref is None:
            return habiles[0]
        # Buscar dias habiles que esten despues de fecha_ref
        despues = [d for d in habiles if d > fecha_ref]
        n = regla_valor_n or 1
        idx = n - 1
        return despues[idx] if idx < len(despues) else habiles[-1]

    # ── dias_habiles_antes: N dias habiles antes de una fecha ref ─────────
    if regla_tipo == "dias_habiles_antes":
        fecha_ref = _calcular_fecha_referencia(ref_tipo, ref_valor, habiles, todos)
        if fecha_ref is None:
            return habiles[-1]
        # Buscar dias habiles que esten antes de fecha_ref, tomar el N desde el final
        antes = [d for d in habiles if d < fecha_ref]
        n = regla_valor_n or 1
        idx = len(antes) - n
        return antes[idx] if idx >= 0 else habiles[0]

    # ── libre_mes: cualquier dia habil del mes (sugerir el primero) ────────
    if regla_tipo == "libre_mes":
        return habiles[0]

    # ── libre_1ra_quincena: primer dia habil de los primeros 15 dias ───────
    if regla_tipo == "libre_1ra_quincena":
        primera = [d for d in habiles if d.day <= 15]
        return primera[0] if primera else habiles[0]

    # ── libre_2da_quincena: primer dia habil de los ultimos dias del mes ───
    if regla_tipo == "libre_2da_quincena":
        segunda = [d for d in habiles if d.day > 15]
        return segunda[0] if segunda else habiles[-1]

    # ── libre_semana_N: primer dia habil de la semana N del mes ───────────
    for n_sem in [1, 2, 3, 4]:
        if regla_tipo == f"libre_semana_{n_sem}":
            inicio = (n_sem - 1) * 7 + 1   # Dia 1, 8, 15, 22
            fin    = n_sem * 7              # Dia 7, 14, 21, 28
            semana = [d for d in habiles if inicio <= d.day <= fin]
            return semana[0] if semana else habiles[0]

    return None   # Regla no reconocida


def _calcular_fecha_referencia(
    ref_tipo: str,
    ref_valor: int,
    habiles: list,
    todos: list,
) -> date:
    """
    DESCRIPCION FUNCIONAL:
      Calcula la fecha de referencia para las reglas antes/despues.
    DESCRIPCION TECNICA:
      Implementa los 4 tipos de referencia definidos en REFS del frontend:
      dia_corrido, dia_habil, ultimo_dia, primer_dia.
    """
    if not ref_tipo:
        return None

    # ── dia_corrido: dia corrido N del mes ────────────────────────────────
    if ref_tipo == "dia_corrido":
        n = ref_valor or 1
        candidatos = [d for d in todos if d.day == n]
        return candidatos[0] if candidatos else todos[-1]

    # ── dia_habil: N-esimo dia habil del mes ──────────────────────────────
    if ref_tipo == "dia_habil":
        n = ref_valor or 1
        idx = n - 1
        return habiles[idx] if idx < len(habiles) else habiles[-1]

    # ── ultimo_dia: ultimo dia del mes ────────────────────────────────────
    if ref_tipo == "ultimo_dia":
        return todos[-1]

    # ── primer_dia: primer dia habil del mes ──────────────────────────────
    if ref_tipo == "primer_dia":
        return habiles[0] if habiles else todos[0]

    return None



class CambiarPrioridadRequest(BaseModel):
    """Esquema para cambiar la prioridad de una tarea."""
    prioridad: str   # urgente | alta | media | baja
 
 
@router.put("/{tarea_id}/prioridad")
async def cambiar_prioridad(
    tarea_id: UUID4,
    datos: CambiarPrioridadRequest,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Cambia la prioridad de una tarea pendiente o pausada.
      Solo supervisores y dueños pueden cambiar la prioridad.
      Operadores no pueden modificar la prioridad de sus tareas.
      Se registra en auditoria el valor anterior y el nuevo.
    DESCRIPCION TECNICA:
      Valida que la tarea sea pendiente o pausada (no en_curso,
      no completada, no vencida).
      Registra el cambio en auditoria_log con valor_anterior y nuevo.
    """
    from sqlalchemy import text as sqlt
 
    PRIORIDADES_VALIDAS = {"urgente", "alta", "media", "baja"}
    if datos.prioridad not in PRIORIDADES_VALIDAS:
        raise HTTPException(400, f"Prioridad inválida. Valores: {PRIORIDADES_VALIDAS}")
 
    tarea = await _obtener_tarea_o_404(tarea_id, db)
    perfiles      = await _obtener_perfiles(usuario_actual.id, db)
    es_supervisor = "supervisor" in perfiles or "dueno" in perfiles \
                    or "administrador" in perfiles
 
    if not es_supervisor:
        raise HTTPException(403, "Solo supervisores pueden cambiar la prioridad")
 
    # Solo se puede cambiar en tareas que no iniciaron aun
    if tarea.estado not in ("pendiente", "pausada"):
        raise HTTPException(
            400,
            f"No se puede cambiar la prioridad de una tarea en estado "
            f"'{tarea.estado}'. Solo en pendientes y pausadas."
        )
 
    prioridad_anterior = tarea.prioridad
 
    # Actualizar con SQL directo
    await db.execute(sqlt("""
        UPDATE tareas SET prioridad = :prioridad WHERE id = :id
    """), {"prioridad": datos.prioridad, "id": str(tarea_id)})
 
    # Registrar en auditoria
    await registrar_auditoria(
        db, "tareas", str(tarea_id), "UPDATE",
        campo="prioridad",
        valor_anterior=prioridad_anterior,
        valor_nuevo=datos.prioridad,
        usuario_id=str(usuario_actual.id)
    )
 
    return {
        "mensaje":            "Prioridad actualizada",
        "prioridad_anterior": prioridad_anterior,
        "prioridad_nueva":    datos.prioridad,
    }
 
 
# ═══════════════════════════════════════════════════════════
# C.2) NUEVO ENDPOINT: POST /heredar-dia
# Hereda tareas no finalizadas al siguiente dia habil
# Agregar ANTES de la sección # HELPERS en tareas.py
# NOTA: debe ir ANTES de /{tarea_id} para que FastAPI
# no lo confunda con un UUID
# ═══════════════════════════════════════════════════════════
 
@router.post("/heredar-dia")
async def heredar_dia(
    fecha: Optional[date] = Query(default=None,
        description="Fecha a heredar (default: hoy)"),
    fecha_destino: Optional[date] = Query(default=None,
        description="Fecha destino (default: próximo día hábil)"),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Hereda las tareas no finalizadas de una fecha al siguiente
      dia habil. Las tareas pendientes y pausadas se copian al
      dia siguiente con estado 'pendiente' y marca es_heredada=TRUE.
      Las tareas pausadas se heredan como pendientes (sin inicio_real).
      Las tareas completadas y vencidas no se heredan.
      Solo supervisores, dueños y administradores pueden ejecutar esto.
    DESCRIPCION TECNICA:
      Calcula el siguiente dia habil consultando los feriados de la BD.
      Crea nuevas filas en tareas con heredada_de_id apuntando al original.
      No modifica las tareas originales.
      Evita duplicar: verifica que no exista ya una tarea heredada
      del mismo origen para ese dia destino.
    """
    from sqlalchemy import text as sqlt
    import uuid as uuid_mod
 
    perfiles = await _obtener_perfiles(usuario_actual.id, db)
    if "administrador" not in perfiles and "dueno" not in perfiles \
       and "supervisor" not in perfiles:
        raise HTTPException(
            403, "Solo supervisores o administradores pueden ejecutar la herencia"
        )
 
    if fecha is None:
        fecha = date.today()
 
    # ── Calcular el siguiente dia habil ──────────────────────────
    # Cargar feriados del año actual y del siguiente
    result_feriados = await db.execute(sqlt("""
        SELECT fecha FROM feriados
        WHERE anio IN (:anio, :anio_sig) AND activo = TRUE
    """), {"anio": fecha.year, "anio_sig": fecha.year + 1})
    feriados = {r.fecha for r in result_feriados.fetchall()}
 
    if fecha_destino:
        # Usar la fecha destino proporcionada por el usuario
        dia_siguiente = fecha_destino
    else:
        # Calcular el próximo día hábil automáticamente
        dia_siguiente = fecha + timedelta(days=1)
        while dia_siguiente.weekday() >= 5 or dia_siguiente in feriados:
            dia_siguiente += timedelta(days=1)
 
    # ── Cargar tareas no finalizadas de la fecha ─────────────────
    result = await db.execute(sqlt("""
        SELECT
            t.id, t.catalogo_tarea_id, t.nombre_personalizado,
            t.descripcion, t.rubro_id, t.asignado_a_id,
            t.cliente_id, t.servicio_id, t.fecha_vencimiento,
            t.prioridad, t.tipo_creacion, t.comentario_supervisor,
            t.creada_por_id
        FROM tareas t
        WHERE t.activa = TRUE
          AND t.fecha_planificada = :fecha
          AND t.estado IN ('pendiente', 'pausada', 'en_curso')
    """), {"fecha": fecha})
    tareas_a_heredar = result.fetchall()
 
    if not tareas_a_heredar:
        return {
            "mensaje":       "No hay tareas para heredar en esa fecha",
            "fecha_origen":  fecha.isoformat(),
            "fecha_destino": dia_siguiente.isoformat(),
            "heredadas":     0,
        }
 
    heredadas = 0
    omitidas  = 0
 
    for t in tareas_a_heredar:
        # Verificar que no exista ya una herencia de esta tarea al dia destino
        dup = await db.execute(sqlt("""
            SELECT id FROM tareas
            WHERE heredada_de_id = :orig_id
              AND fecha_planificada = :destino
              AND activa = TRUE
        """), {"orig_id": str(t.id), "destino": dia_siguiente})
        if dup.fetchone():
            omitidas += 1
            continue
 
        nuevo_id = str(uuid_mod.uuid4())
 
        # Crear la tarea heredada — siempre en estado 'pendiente'
        # aunque la original estuviera pausada o en_curso
        await db.execute(sqlt("""
            INSERT INTO tareas (
                id, catalogo_tarea_id, nombre_personalizado, descripcion,
                rubro_id, asignado_a_id, cliente_id, servicio_id,
                fecha_planificada, fecha_vencimiento, prioridad, estado,
                creada_por_id, tipo_creacion, comentario_supervisor,
                heredada_de_id, es_heredada, activa, creado_en
            ) VALUES (
                :id, :catalogo_tarea_id, :nombre_personalizado, :descripcion,
                :rubro_id, :asignado_a_id, :cliente_id, :servicio_id,
                :destino, :fecha_vencimiento, :prioridad, 'pendiente',
                :creada_por_id, :tipo_creacion, :comentario_supervisor,
                :origen_id, TRUE, TRUE, NOW()
            )
        """), {
            "id":                   nuevo_id,
            "catalogo_tarea_id":    str(t.catalogo_tarea_id) if t.catalogo_tarea_id else None,
            "nombre_personalizado": t.nombre_personalizado,
            "descripcion":          t.descripcion,
            "rubro_id":             str(t.rubro_id)       if t.rubro_id       else None,
            "asignado_a_id":        str(t.asignado_a_id),
            "cliente_id":           str(t.cliente_id)     if t.cliente_id     else None,
            "servicio_id":          str(t.servicio_id)    if t.servicio_id    else None,
            "destino":              dia_siguiente,
            "fecha_vencimiento":    t.fecha_vencimiento,
            "prioridad":            t.prioridad,
            "creada_por_id":        str(t.creada_por_id),
            "tipo_creacion":        t.tipo_creacion,
            "comentario_supervisor": t.comentario_supervisor,
            "origen_id":            str(t.id),
        })
        heredadas += 1
 
    return {
        "mensaje":       f"{heredadas} tarea(s) heredadas al siguiente día hábil",
        "fecha_origen":  fecha.isoformat(),
        "fecha_destino": dia_siguiente.isoformat(),
        "heredadas":     heredadas,
        "omitidas":      omitidas,
    }

# ============================================================
# HELPERS (funciones auxiliares)
# ============================================================

async def _obtener_tarea_o_404(tarea_id, db: AsyncSession) -> Tarea:
    result = await db.execute(
        select(Tarea).where(Tarea.id == tarea_id, Tarea.activa == True)
    )
    tarea = result.scalar_one_or_none()
    if not tarea:
        raise HTTPException(404, "Tarea no encontrada")
    return tarea


async def _obtener_perfiles(usuario_id, db: AsyncSession) -> List[str]:
    from app.models.usuario import UsuarioPerfil, Perfil
    result = await db.execute(
        select(Perfil.codigo)
        .join(UsuarioPerfil, UsuarioPerfil.perfil_id == Perfil.id)
        .where(UsuarioPerfil.usuario_id == usuario_id, UsuarioPerfil.activo == True)
    )
    return [row[0] for row in result.fetchall()]


async def _verificar_acceso_tarea(tarea: Tarea, usuario: Usuario, db: AsyncSession):
    perfiles = await _obtener_perfiles(usuario.id, db)
    es_supervisor = "supervisor" in perfiles or "dueno" in perfiles or "administrador" in perfiles
    es_propia = tarea.asignado_a_id == usuario.id
    
    if not es_supervisor and not es_propia:
        raise HTTPException(403, "No tenés acceso a esta tarea")


def _tarea_a_dict(tarea: Tarea) -> dict:
    """
    DESCRIPCION FUNCIONAL:
      Serializa un objeto Tarea ORM a dict.
      Se usa en los endpoints que trabajan con una tarea individual
      (obtener, iniciar, pausar, reanudar, finalizar).
      El listado general usa SQL directo con JOINs (ver listar_tareas).
    DESCRIPCION TECNICA:
      Los campos de nombre de entidades relacionadas (operador,
      cliente, servicio) no estan disponibles aqui porque el ORM
      no los carga (lazy loading deshabilitado para evitar N+1).
      El frontend debe usar los datos del listado enriquecido.
    """
    return {
        "id":                       str(tarea.id),
        "tarea_nombre":             tarea.nombre_personalizado or "",
        "tarea_codigo":             "",
        "descripcion":              tarea.descripcion,
        "estado":                   tarea.estado,
        "prioridad":                tarea.prioridad,
        "fecha_planificada":        tarea.fecha_planificada.isoformat() if tarea.fecha_planificada else None,
        "fecha_vencimiento":        tarea.fecha_vencimiento.isoformat() if tarea.fecha_vencimiento else None,
        "inicio_real":              tarea.inicio_real.isoformat()       if tarea.inicio_real       else None,
        "fin_real":                 tarea.fin_real.isoformat()          if tarea.fin_real          else None,
        "tiempo_trabajado_minutos": tarea.tiempo_trabajado_minutos,
        "es_heredada":              tarea.es_heredada,
        "tipo_creacion":            tarea.tipo_creacion,
        "comentario_supervisor":    tarea.comentario_supervisor,
        "comentario_operador":      tarea.comentario_operador,
        "asignado_a_id":            str(tarea.asignado_a_id),
        "operador_nombre":          "",
        "cliente_id":               str(tarea.cliente_id)  if tarea.cliente_id  else None,
        "cliente_nombre":           "",
        "servicio_id":              str(tarea.servicio_id) if tarea.servicio_id else None,
        "servicio_nombre":          "",
        "rubro_id":                 str(tarea.rubro_id)    if tarea.rubro_id    else None,
        "creado_en":                tarea.creado_en.isoformat() if tarea.creado_en else None,
    }

