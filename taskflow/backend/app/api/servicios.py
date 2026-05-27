"""
=============================================================
Archivo: servicios.py
-------------------------------------------------------------
DESCRIPCIÓN FUNCIONAL:
  API REST para gestión de servicios del estudio contable.
  Permite crear, editar y eliminar servicios y sus tareas asociadas.
  Los servicios pueden anidarse (un servicio puede tener servicios hijos).
  Incluye endpoints para consultar sub-servicios de un padre y los
  servicios contratados por un cliente.

DESCRIPCIÓN TÉCNICA:
  Router FastAPI con SQLAlchemy async sobre PostgreSQL (psycopg).
  Todas las operaciones de escritura usan db.flush() para integración
  con el sistema de transacciones del middleware de sesión.
  El orden de rutas es deliberado: las rutas con segmentos fijos
  (ej: /servicio-tarea/, /subservicios) se declaran antes que las
  rutas con parámetros dinámicos para evitar colisiones en FastAPI.
=============================================================
"""

# ── Importaciones estándar y de terceros ────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException, Query   # Framework web y utilidades
from sqlalchemy.ext.asyncio import AsyncSession                # Sesión async de SQLAlchemy
from sqlalchemy import text                                    # SQL crudo con parámetros seguros
from pydantic import BaseModel                                 # Validación de modelos de entrada
from typing import Optional                                    # Tipos opcionales
import uuid                                                    # Generación de UUIDs para nuevos registros

# ── Importaciones internas del proyecto ─────────────────────────────────────
from app.core.database import get_db                           # Dependencia de sesión de BD
from app.api.auth import obtener_usuario_actual, obtener_empresa_id                # Dependencia de autenticación JWT/OAuth
from app.models.usuario import Usuario                         # Modelo ORM de usuario

# ── Inicialización del router ────────────────────────────────────────────────
router = APIRouter()


# =============================================================================
# MODELOS PYDANTIC — Esquemas de entrada para los endpoints POST/PUT
# =============================================================================

class ServicioCrear(BaseModel):
    """
    DESCRIPCIÓN FUNCIONAL:
      Esquema de datos para crear o editar un servicio.
    DESCRIPCIÓN TÉCNICA:
      Pydantic BaseModel. servicio_padre_id es opcional (None = servicio raíz).
    """
    codigo: str                             # Código único del servicio (se guarda en mayúsculas)
    nombre: str                             # Nombre descriptivo del servicio
    descripcion: Optional[str] = None      # Descripción larga, opcional
    servicio_padre_id: Optional[str] = None # UUID del servicio padre, None si es raíz


class TareaServicioCrear(BaseModel):
    """
    DESCRIPCIÓN FUNCIONAL:
      Esquema de datos para agregar o editar una tarea dentro de un servicio.
    DESCRIPCIÓN TÉCNICA:
      Incluye todos los campos de calendarización: tipo, regla, valor N
      y referencia temporal. Los campos de regla solo aplican cuando
      tipo_calendarizacion == 'automatica'.
    """
    catalogo_tarea_id: Optional[str] = None          # UUID de la tarea del catálogo (requerido en alta)
    tipo_calendarizacion: str = "excepcional"         # 'excepcional', 'manual' o 'automatica'
    regla_tipo: Optional[str] = None                  # Tipo de regla si es automática
    regla_valor_n: Optional[int] = None               # Valor N numérico de la regla
    ref_tipo: Optional[str] = None                    # Tipo de fecha de referencia (para antes/después)
    ref_valor: Optional[int] = None                   # Valor numérico de la fecha de referencia
    es_obligatoria: bool = True                        # Si la tarea es obligatoria en el servicio
    orden: int = 0                                     # Número de orden dentro del servicio
    duracion_estimada_minutos: int = 30               # Duración estimada de ejecución en minutos


# =============================================================================
# ENDPOINT: GET /
# Lista todos los servicios con cantidad de tareas e info del padre
# =============================================================================

@router.get("/")
async def listar_servicios(
    activo: bool = Query(default=True),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    empresa_id: str = Depends(obtener_empresa_id),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Lista todos los servicios del sistema con su información básica,
      incluyendo el nombre del servicio padre (si lo tiene) y la cantidad
      de tareas activas asociadas.
    DESCRIPCIÓN TÉCNICA:
      JOIN con tabla servicios (auto-join para padre) y servicio_tareas.
      GROUP BY para contar tareas. NULLS FIRST en ORDER BY agrupa primero
      los servicios raíz (sin padre).
    """
    # Consulta con JOIN al padre y conteo de tareas activas
    result = await db.execute(text("""
        SELECT
            s.id,                                -- UUID del servicio
            s.codigo,                            -- Código alfanumérico único
            s.nombre,                            -- Nombre del servicio
            s.descripcion,                       -- Descripción larga
            s.activo,                            -- Estado activo/inactivo
            s.servicio_padre_id,                 -- UUID del padre (NULL si es raíz)
            sp.nombre AS servicio_padre_nombre,  -- Nombre del padre para mostrar en UI
            COUNT(st.id) AS cantidad_tareas      -- Cantidad de tareas activas
        FROM servicios s
        LEFT JOIN servicios sp ON s.servicio_padre_id = sp.id          -- JOIN auto-referencial para padre
        LEFT JOIN servicio_tareas st ON s.id = st.servicio_id
            AND st.activo = TRUE                 -- Solo tareas activas en el conteo
        WHERE s.activo = :activo
        {"AND s.empresa_id = :empresa_id" if empresa_id else ""}
        GROUP BY s.id, s.codigo, s.nombre, s.descripcion,
                 s.activo, s.servicio_padre_id, sp.nombre
        ORDER BY sp.nombre NULLS FIRST, s.nombre  -- Raíces primero, luego por nombre
    """), {"activo": activo, **( {"empresa_id": empresa_id} if empresa_id else {} )})

    rows = result.fetchall()  # Trae todos los resultados a memoria

    # Serializar cada fila a dict con tipos Python nativos (str para UUID)
    return [
        {
            "id": str(r.id),
            "codigo": r.codigo,
            "nombre": r.nombre,
            "descripcion": r.descripcion,
            "activo": r.activo,
            "servicio_padre_id": str(r.servicio_padre_id) if r.servicio_padre_id else None,
            "servicio_padre_nombre": r.servicio_padre_nombre,
            "cantidad_tareas": r.cantidad_tareas,
        }
        for r in rows
    ]


# =============================================================================
# ENDPOINT: POST /
# Crea un nuevo servicio
# =============================================================================

@router.post("/", status_code=201)
async def crear_servicio(
    datos: ServicioCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Crea un nuevo servicio. El código debe ser único en el sistema.
      Puede ser raíz o sub-servicio de un padre existente.
    DESCRIPCIÓN TÉCNICA:
      Verifica unicidad de código y existencia del padre antes de insertar.
      Genera UUID nuevo para el registro. Retorna el ID creado.
    """
    # Verificar que no exista otro servicio activo con el mismo código
    existe = await db.execute(text(
        "SELECT id FROM servicios WHERE codigo = :codigo AND activo = TRUE"
    ), {"codigo": datos.codigo.upper()})
    if existe.fetchone():
        raise HTTPException(400, f"Ya existe un servicio con el código '{datos.codigo}'")

    # Si se indicó un padre, verificar que exista y esté activo
    if datos.servicio_padre_id:
        padre = await db.execute(text(
            "SELECT id FROM servicios WHERE id = :id AND activo = TRUE"
        ), {"id": datos.servicio_padre_id})
        if not padre.fetchone():
            raise HTTPException(404, "El servicio padre indicado no existe")

    # Generar nuevo UUID para el servicio
    nuevo_id = str(uuid.uuid4())

    # Insertar el nuevo servicio en la tabla
    await db.execute(text("""
        INSERT INTO servicios
            (id, codigo, nombre, descripcion, servicio_padre_id, activo, fecha_alta, creado_por)
        VALUES
            (:id, :codigo, :nombre, :descripcion, :padre_id, TRUE, CURRENT_DATE, :creado_por)
    """), {
        "id": nuevo_id,
        "codigo": datos.codigo.upper(),          # Siempre en mayúsculas
        "nombre": datos.nombre,
        "descripcion": datos.descripcion,
        "padre_id": datos.servicio_padre_id or None,
        "creado_por": str(usuario_actual.id),    # Auditoría: quién creó
    })
    await db.flush()  # Propaga el INSERT dentro de la transacción activa

    return {"id": nuevo_id, "mensaje": "Servicio creado correctamente"}


# =============================================================================
# ENDPOINT: PUT /{servicio_id}
# Edita un servicio existente
# =============================================================================

@router.put("/{servicio_id}")
async def editar_servicio(
    servicio_id: str,
    datos: ServicioCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Edita nombre, descripción y padre de un servicio existente.
      El código no se puede cambiar una vez creado (es el identificador natural).
    DESCRIPCIÓN TÉCNICA:
      Verifica existencia antes de actualizar. No modifica el campo codigo.
    """
    # Verificar que el servicio a editar exista y esté activo
    existe = await db.execute(text(
        "SELECT id FROM servicios WHERE id = :id AND activo = TRUE"
    ), {"id": servicio_id})
    if not existe.fetchone():
        raise HTTPException(404, "Servicio no encontrado")

    # Actualizar solo los campos editables (código no se toca)
    await db.execute(text("""
        UPDATE servicios SET
            nombre            = :nombre,
            descripcion       = :descripcion,
            servicio_padre_id = :padre_id
        WHERE id = :id
    """), {
        "nombre": datos.nombre,
        "descripcion": datos.descripcion,
        "padre_id": datos.servicio_padre_id or None,
        "id": servicio_id,
    })
    await db.flush()  # Propaga el UPDATE dentro de la transacción activa

    return {"mensaje": "Servicio actualizado correctamente"}


# =============================================================================
# ENDPOINT: DELETE /{servicio_id}
# Baja lógica de un servicio
# =============================================================================

@router.delete("/{servicio_id}")
async def eliminar_servicio(
    servicio_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Desactiva un servicio (baja lógica, no elimina físicamente).
      El registro queda en BD con activo=FALSE para auditoría histórica.
    DESCRIPCIÓN TÉCNICA:
      Simple UPDATE de flag activo. No verifica impacto en sub-servicios
      ni en tareas asignadas (pendiente: ítem 4 del backlog).
    """
    # Marcar el servicio como inactivo sin borrar el registro
    await db.execute(text(
        "UPDATE servicios SET activo = FALSE WHERE id = :id"
    ), {"id": servicio_id})
    await db.flush()  # Propaga el UPDATE dentro de la transacción activa

    return {"mensaje": "Servicio desactivado"}


# =============================================================================
# ENDPOINT: GET /{servicio_id}/subservicios
# Lista los sub-servicios directos de un servicio padre
# NOTA: este endpoint debe declararse ANTES de /{servicio_id}/tareas y de
# los endpoints con rutas fijas como /servicio-tarea/ y /clientes/ para
# evitar colisiones de routing en FastAPI.
# =============================================================================

@router.get("/{servicio_id}/subservicios")
async def subservicios_del_servicio(
    servicio_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Retorna todos los sub-servicios directos (hijos de primer nivel)
      de un servicio padre. Para cada hijo muestra: id, código, nombre,
      descripción y cantidad de tareas activas propias.
      Se usa en el panel de tareas del padre para mostrar la jerarquía.
    DESCRIPCIÓN TÉCNICA:
      Filtra por servicio_padre_id = servicio_id. LEFT JOIN con
      servicio_tareas para contar las tareas de cada hijo. Solo
      sub-servicios activos. El front-end renderiza estos ítems
      como tarjetas especiales (no son tareas, son sub-servicios).
    """
    # Consultar hijos directos del padre con conteo de sus tareas propias
    result = await db.execute(text("""
        SELECT
            s.id,                               -- UUID del sub-servicio
            s.codigo,                           -- Código alfanumérico del sub-servicio
            s.nombre,                           -- Nombre del sub-servicio
            s.descripcion,                      -- Descripción larga del sub-servicio
            COUNT(st.id) AS cantidad_tareas     -- Cantidad de tareas activas del sub-servicio
        FROM servicios s
        LEFT JOIN servicio_tareas st
            ON s.id = st.servicio_id
            AND st.activo = TRUE                -- Solo tareas activas en el conteo
        WHERE
            s.servicio_padre_id = :padre_id     -- Solo hijos directos del padre dado
            AND s.activo = TRUE                 -- Solo sub-servicios activos
        GROUP BY s.id, s.codigo, s.nombre, s.descripcion
        ORDER BY s.nombre                       -- Orden alfabético por nombre
    """), {"padre_id": servicio_id})

    rows = result.fetchall()  # Trae todos los hijos a memoria

    # Serializar cada fila a dict con tipos Python nativos
    return [
        {
            "id": str(r.id),                    # UUID como string para JSON
            "codigo": r.codigo,                 # Código alfanumérico
            "nombre": r.nombre,                 # Nombre del sub-servicio
            "descripcion": r.descripcion,       # Descripción (puede ser None)
            "cantidad_tareas": r.cantidad_tareas,  # Entero: cuántas tareas tiene
        }
        for r in rows
    ]


# =============================================================================
# ENDPOINT: GET /{servicio_id}/tareas
# Lista las tareas de un servicio con su parametría completa
# =============================================================================

@router.get("/{servicio_id}/tareas")
async def tareas_del_servicio(
    servicio_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Lista todas las tareas del catálogo asignadas a un servicio,
      con su parametría de calendarización completa: tipo, regla,
      valor N, referencia, duración estimada y obligatoriedad.
    DESCRIPCIÓN TÉCNICA:
      JOIN con catalogo_tareas y rubros_tarea. Solo registros activos
      en servicio_tareas. Ordenado por campo orden y luego por nombre.
    """
    # Consultar tareas del servicio con datos del catálogo y el rubro
    result = await db.execute(text("""
        SELECT
            st.id,                              -- UUID de la relación servicio-tarea
            st.orden,                           -- Número de orden dentro del servicio
            st.es_obligatoria,                  -- Si la tarea es obligatoria
            st.tipo_calendarizacion,            -- 'excepcional', 'manual' o 'automatica'
            st.regla_tipo,                      -- Tipo de regla automática
            st.regla_valor_n,                   -- Valor N de la regla
            st.ref_tipo,                        -- Tipo de fecha de referencia
            st.ref_valor,                       -- Valor numérico de la referencia
            st.duracion_estimada_minutos,       -- Duración estimada en minutos
            ct.id   AS catalogo_tarea_id,       -- UUID de la tarea en el catálogo
            ct.codigo AS tarea_codigo,          -- Código de la tarea (ej: T001)
            ct.nombre AS tarea_nombre,          -- Nombre de la tarea
            rt.nombre AS rubro                  -- Rubro de la tarea (ej: impuestos)
        FROM servicio_tareas st
        JOIN catalogo_tareas ct ON st.catalogo_tarea_id = ct.id   -- JOIN al catálogo
        LEFT JOIN rubros_tarea rt ON ct.rubro_id = rt.id          -- JOIN opcional al rubro
        WHERE st.servicio_id = :sid             -- Solo tareas del servicio pedido
          AND st.activo = TRUE                  -- Solo relaciones activas
        ORDER BY st.orden, ct.nombre            -- Primero por orden, luego alfabético
    """), {"sid": servicio_id})

    rows = result.fetchall()  # Trae todas las tareas a memoria

    # Serializar cada fila a dict con tipos Python nativos
    return [
        {
            "id": str(r.id),
            "orden": r.orden,
            "es_obligatoria": r.es_obligatoria,
            "tipo_calendarizacion": r.tipo_calendarizacion,
            "regla_tipo": r.regla_tipo,
            "regla_valor_n": r.regla_valor_n,
            "ref_tipo": r.ref_tipo,
            "ref_valor": r.ref_valor,
            "duracion_estimada_minutos": r.duracion_estimada_minutos,
            "catalogo_tarea_id": str(r.catalogo_tarea_id),
            "tarea_codigo": r.tarea_codigo,
            "tarea_nombre": r.tarea_nombre,
            "rubro": r.rubro,
        }
        for r in rows
    ]


# =============================================================================
# ENDPOINT: POST /{servicio_id}/tareas
# Agrega una tarea del catálogo a un servicio
# =============================================================================

@router.post("/{servicio_id}/tareas", status_code=201)
async def agregar_tarea_servicio(
    servicio_id: str,
    datos: TareaServicioCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Agrega una tarea del catálogo a un servicio con su parametría
      de calendarización. Valida que el servicio y la tarea existan
      y que la tarea no esté ya asociada al servicio.
    DESCRIPCIÓN TÉCNICA:
      Verifica existencia en tres pasos: servicio, tarea del catálogo
      y duplicados. Genera UUID nuevo para la relación servicio-tarea.
    """
    # Verificar que el servicio exista y esté activo
    svc = await db.execute(text(
        "SELECT id FROM servicios WHERE id = :id AND activo = TRUE"
    ), {"id": servicio_id})
    if not svc.fetchone():
        raise HTTPException(404, "Servicio no encontrado")

    # Verificar que la tarea del catálogo exista y esté activa
    tarea = await db.execute(text(
        "SELECT id FROM catalogo_tareas WHERE id = :id AND activo = TRUE"
    ), {"id": datos.catalogo_tarea_id})
    if not tarea.fetchone():
        raise HTTPException(404, "Tarea no encontrada en el catálogo")

    # Verificar que la tarea no esté ya asociada al servicio (evitar duplicados)
    ya_existe = await db.execute(text("""
        SELECT id FROM servicio_tareas
        WHERE servicio_id = :sid AND catalogo_tarea_id = :tid AND activo = TRUE
    """), {"sid": servicio_id, "tid": datos.catalogo_tarea_id})
    if ya_existe.fetchone():
        raise HTTPException(400, "Esta tarea ya está en el servicio")

    # Generar nuevo UUID para la relación servicio-tarea
    nuevo_id = str(uuid.uuid4())

    # Insertar la nueva relación con toda la parametría de calendarización
    await db.execute(text("""
        INSERT INTO servicio_tareas
            (id, servicio_id, catalogo_tarea_id, tipo_calendarizacion,
             regla_tipo, regla_valor_n, ref_tipo, ref_valor,
             es_obligatoria, orden, duracion_estimada_minutos, activo)
        VALUES
            (:id, :sid, :tarea_id, :tipo_cal,
             :regla_tipo, :regla_n, :ref_tipo, :ref_valor,
             :obligatoria, :orden, :duracion, TRUE)
    """), {
        "id": nuevo_id,
        "sid": servicio_id,
        "tarea_id": datos.catalogo_tarea_id,
        "tipo_cal": datos.tipo_calendarizacion,
        "regla_tipo": datos.regla_tipo,
        "regla_n": datos.regla_valor_n,
        "ref_tipo": datos.ref_tipo,
        "ref_valor": datos.ref_valor,
        "obligatoria": datos.es_obligatoria,
        "orden": datos.orden,
        "duracion": datos.duracion_estimada_minutos,
    })
    await db.flush()  # Propaga el INSERT dentro de la transacción activa

    return {"id": nuevo_id, "mensaje": "Tarea agregada al servicio correctamente"}


# =============================================================================
# ENDPOINT: PUT /servicio-tarea/{st_id}
# Edita la parametría de una tarea dentro de un servicio
# NOTA: esta ruta con segmento fijo "servicio-tarea" debe declararse
# ANTES de cualquier ruta con parámetro dinámico {servicio_id} en el router.
# =============================================================================

@router.put("/servicio-tarea/{st_id}")
async def editar_tarea_servicio(
    st_id: str,
    datos: TareaServicioCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Edita la parametría de calendarización de una tarea ya asignada
      a un servicio: tipo, regla, valores N y de referencia, obligatoriedad,
      orden y duración estimada.
    DESCRIPCIÓN TÉCNICA:
      No cambia qué tarea del catálogo es; solo actualiza los metadatos
      de la relación servicio_tareas. Verifica existencia antes de actualizar.
    """
    # Verificar que la relación servicio-tarea exista y esté activa
    existe = await db.execute(text(
        "SELECT id FROM servicio_tareas WHERE id = :id AND activo = TRUE"
    ), {"id": st_id})
    if not existe.fetchone():
        raise HTTPException(404, "Relación servicio-tarea no encontrada")

    # Actualizar todos los campos de parametría (la tarea del catálogo no cambia)
    await db.execute(text("""
        UPDATE servicio_tareas SET
            tipo_calendarizacion      = :tipo_cal,
            regla_tipo                = :regla_tipo,
            regla_valor_n             = :regla_n,
            ref_tipo                  = :ref_tipo,
            ref_valor                 = :ref_valor,
            es_obligatoria            = :obligatoria,
            orden                     = :orden,
            duracion_estimada_minutos = :duracion
        WHERE id = :id
    """), {
        "tipo_cal":    datos.tipo_calendarizacion,
        "regla_tipo":  datos.regla_tipo,
        "regla_n":     datos.regla_valor_n,
        "ref_tipo":    datos.ref_tipo,
        "ref_valor":   datos.ref_valor,
        "obligatoria": datos.es_obligatoria,
        "orden":       datos.orden,
        "duracion":    datos.duracion_estimada_minutos,
        "id":          st_id,
    })
    await db.flush()  # Propaga el UPDATE dentro de la transacción activa

    return {"mensaje": "Tarea actualizada correctamente"}


# =============================================================================
# ENDPOINT: DELETE /servicio-tarea/{st_id}
# Quita una tarea de un servicio (baja lógica)
# =============================================================================

@router.delete("/servicio-tarea/{st_id}")
async def quitar_tarea_servicio(
    st_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Desvincula una tarea de un servicio mediante baja lógica.
      El registro queda en BD con activo=FALSE para historial.
    DESCRIPCIÓN TÉCNICA:
      Simple UPDATE del flag activo. Verifica existencia (sin filtro
      de activo) para poder informar si el ID es inválido.
    """
    # Verificar que la relación exista (sin filtro activo para detectar IDs inválidos)
    existe = await db.execute(text(
        "SELECT id FROM servicio_tareas WHERE id = :id"
    ), {"id": st_id})
    if not existe.fetchone():
        raise HTTPException(404, "Relación servicio-tarea no encontrada")

    # Marcar como inactiva sin eliminar físicamente el registro
    await db.execute(text(
        "UPDATE servicio_tareas SET activo = FALSE WHERE id = :id"
    ), {"id": st_id})
    await db.flush()  # Propaga el UPDATE dentro de la transacción activa

    return {"mensaje": "Tarea quitada del servicio"}


# =============================================================================
# ENDPOINT: GET /clientes/{cliente_id}
# Lista los servicios contratados por un cliente
# =============================================================================

@router.get("/clientes/{cliente_id}")
async def servicios_de_cliente(
    cliente_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Lista los servicios contratados por un cliente específico,
      incluyendo la fecha de inicio del contrato y el estado activo.
    DESCRIPCIÓN TÉCNICA:
      JOIN entre cliente_servicios y servicios. Ordenado por nombre
      de servicio. Se usa en la pantalla de ABM clientes-servicios.
    """
    # Consultar servicios vinculados al cliente mediante la tabla pivot
    result = await db.execute(text("""
        SELECT
            s.id,                               -- UUID del servicio
            s.nombre,                           -- Nombre del servicio
            s.codigo,                           -- Código del servicio
            cs.fecha_inicio,                    -- Fecha de inicio del contrato
            cs.activo                           -- Estado activo de la contratación
        FROM cliente_servicios cs
        JOIN servicios s ON cs.servicio_id = s.id   -- JOIN al servicio contratado
        WHERE cs.cliente_id = :cid              -- Solo del cliente solicitado
        ORDER BY s.nombre                       -- Orden alfabético por nombre
    """), {"cid": cliente_id})

    # Serializar cada fila; fecha_inicio se convierte a string ISO
    return [
        {
            "servicio_id": str(r.id),
            "nombre": r.nombre,
            "codigo": r.codigo,
            "activo": r.activo,
            "fecha_inicio": r.fecha_inicio.isoformat() if r.fecha_inicio else None,
        }
        for r in result.fetchall()
    ]