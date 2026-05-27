"""
=============================================================
Archivo: clientes.py
Versión: v1.1.1
-------------------------------------------------------------
DESCRIPCIÓN FUNCIONAL:
  API REST para gestión de clientes del estudio contable.
  Permite listar, crear, editar, desactivar y reactivar clientes.
  Incluye validación del CUIT argentino (algoritmo AFIP módulo 11)
  y endpoints para gestionar servicios asignados a cada cliente
  (ABM de la tabla cliente_servicios).

  La relación cliente-servicio tiene:
  - fecha_inicio: cuándo empezó el servicio
  - fecha_fin: fecha de baja del servicio (NULL = activo)
  - activo: flag de baja lógica del registro
  Un servicio se considera vigente si activo=TRUE y
  (fecha_fin IS NULL OR fecha_fin >= hoy).

DESCRIPCIÓN TÉCNICA:
  Router FastAPI con SQLAlchemy async (psycopg).
  GET /clientes/ incluye cantidad_servicios (vigentes) por cliente.
  GET /clientes/{id}/servicios devuelve todos los servicios con
  su estado vigente calculado server-side.

HISTORIAL:
  v1.0.0 - ABM completo + validaciones + panel de servicios.
  v1.1.0 - fecha_fin en servicios, cantidad_servicios en listado,
  v1.1.1 - Fix: endpoint editar fecha_fin cambiado de PATCH a PUT.
            campo notas en asignación, endpoint PATCH para baja
            de servicio por fecha_fin.
=============================================================
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel
from typing import Optional
from datetime import date
import uuid

from app.core.database import get_db
from app.api.auth import obtener_usuario_actual, obtener_empresa_id
from app.models.usuario import Usuario
from app.models.cliente import Cliente

router = APIRouter()


# =============================================================================
# MODELOS PYDANTIC
# =============================================================================

class ClienteCrear(BaseModel):
    """Esquema para crear o editar un cliente."""
    razon_social: str
    cuit: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    localidad: Optional[str] = None
    provincia: Optional[str] = "Buenos Aires"
    responsable_interno_id: Optional[str] = None
    notas: Optional[str] = None


class ClienteServicioAsignar(BaseModel):
    """
    DESCRIPCIÓN FUNCIONAL: Esquema para asignar un servicio a un cliente.
    DESCRIPCIÓN TÉCNICA: fecha_fin nula significa servicio vigente sin fecha
      de vencimiento. notas es texto libre de la asignación.
    """
    servicio_id: str                      # UUID del servicio a asignar
    fecha_inicio: Optional[date] = None   # Fecha de inicio de la asignación
    fecha_fin: Optional[date] = None      # Fecha de baja del servicio (NULL = vigente)
    notas: Optional[str] = None           # Notas de la asignación


class ClienteServicioBaja(BaseModel):
    """
    DESCRIPCIÓN FUNCIONAL: Esquema para dar de baja un servicio de un cliente.
    DESCRIPCIÓN TÉCNICA: Registra la fecha_fin en la relación cliente_servicios.
      Si fecha_fin es None se limpia la fecha (reactiva el servicio).
    """
    fecha_fin: Optional[date] = None      # Fecha de baja (None = quitar la baja)
    notas: Optional[str] = None           # Notas opcionales del motivo de baja


# =============================================================================
# FUNCIÓN: validar_cuit
# =============================================================================

def validar_cuit(cuit: str) -> bool:
    """
    DESCRIPCIÓN FUNCIONAL: Valida CUIT argentino con algoritmo AFIP módulo 11.
    DESCRIPCIÓN TÉCNICA: Pesos [5,4,3,2,7,6,5,4,3,2]. Retorna True si válido.
    """
    limpio = cuit.replace("-", "").replace(" ", "").strip()
    if len(limpio) != 11 or not limpio.isdigit():
        return False
    pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    suma  = sum(int(limpio[i]) * pesos[i] for i in range(10))
    resto = suma % 11
    dv    = 0 if resto == 0 else (9 if resto == 1 else 11 - resto)
    return int(limpio[-1]) == dv


# =============================================================================
# ENDPOINT: GET /
# Incluye cantidad de servicios vigentes por cliente
# =============================================================================

@router.get("/")
async def listar_clientes(
    activo: bool = Query(default=True),
    busqueda: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    empresa_id: str = Depends(obtener_empresa_id)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Lista clientes con filtro opcional de texto libre.
      Incluye cantidad_servicios: servicios vigentes de cada cliente
      (activo=TRUE y fecha_fin nula o futura).
    DESCRIPCIÓN TÉCNICA:
      Subquery con COUNT para servicios vigentes. LEFT JOIN para
      que clientes sin servicios muestren 0.
    """
    filtros = ["c.activo = :activo"]
    params  = {"activo": activo, "hoy": date.today()}
    if empresa_id:
        filtros.append("c.empresa_id = :empresa_id")
        params["empresa_id"] = empresa_id
    if busqueda and busqueda.strip():
        filtros.append("(c.razon_social ILIKE :busqueda OR c.cuit ILIKE :busqueda)")
        params["busqueda"] = f"%{busqueda.strip()}%"

    result = await db.execute(text(f"""
        SELECT
            c.id, c.razon_social, c.cuit, c.email, c.telefono,
            c.direccion, c.localidad, c.provincia, c.notas,
            c.activo, c.fecha_alta,
            u.nombre || ' ' || u.apellido AS responsable_nombre,
            /* Cantidad de servicios vigentes: activo Y (sin fecha_fin O fecha_fin futura) */
            COUNT(cs.id) FILTER (
                WHERE cs.activo = TRUE
                AND (cs.fecha_fin IS NULL OR cs.fecha_fin >= :hoy)
            ) AS cantidad_servicios
        FROM clientes c
        LEFT JOIN usuarios u ON c.responsable_interno_id = u.id
        LEFT JOIN cliente_servicios cs ON cs.cliente_id = c.id
        WHERE {" AND ".join(filtros)}
        GROUP BY c.id, c.razon_social, c.cuit, c.email, c.telefono,
                 c.direccion, c.localidad, c.provincia, c.notas,
                 c.activo, c.fecha_alta, u.nombre, u.apellido
        ORDER BY c.razon_social
    """), params)

    return [
        {
            "id":                 str(r.id),
            "razon_social":       r.razon_social,
            "cuit":               r.cuit,
            "email":              r.email,
            "telefono":           r.telefono,
            "direccion":          r.direccion,
            "localidad":          r.localidad,
            "provincia":          r.provincia,
            "notas":              r.notas,
            "activo":             r.activo,
            "fecha_alta":         r.fecha_alta.isoformat() if r.fecha_alta else None,
            "responsable_nombre": r.responsable_nombre,
            "cantidad_servicios": int(r.cantidad_servicios or 0),
        }
        for r in result.fetchall()
    ]


# =============================================================================
# ENDPOINT: GET /{cliente_id}
# =============================================================================

@router.get("/{cliente_id}")
async def obtener_cliente(
    cliente_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Retorna todos los datos de un cliente específico."""
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    return {
        "id": str(c.id), "razon_social": c.razon_social, "cuit": c.cuit,
        "email": c.email, "telefono": c.telefono, "direccion": c.direccion,
        "localidad": c.localidad, "provincia": c.provincia, "notas": c.notas,
        "activo": c.activo,
        "responsable_interno_id": str(c.responsable_interno_id) if c.responsable_interno_id else None,
    }


# =============================================================================
# ENDPOINT: POST /
# =============================================================================

@router.post("/", status_code=201)
async def crear_cliente(
    datos: ClienteCrear,
    db: AsyncSession = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Crea un nuevo cliente. Valida CUIT y unicidad si se proporcionó."""
    if datos.cuit and datos.cuit.strip():
        cuit_limpio = datos.cuit.replace("-", "").replace(" ", "").strip()
        if not validar_cuit(cuit_limpio):
            raise HTTPException(400, f"El CUIT '{datos.cuit}' no es válido")
        dup = await db.execute(text(
            "SELECT id FROM clientes WHERE cuit = :c AND activo = TRUE"
        ), {"c": cuit_limpio})
        if dup.fetchone():
            raise HTTPException(400, f"Ya existe un cliente activo con el CUIT {datos.cuit}")
        datos_dict = datos.dict()
        datos_dict["cuit"] = cuit_limpio
    else:
        datos_dict = datos.dict()
        datos_dict["cuit"] = None

    c = Cliente(**datos_dict, activo=True, fecha_alta=date.today(), creado_por=usuario_actual.id, empresa_id=empresa_id)
    db.add(c)
    await db.flush()
    return {"id": str(c.id), "mensaje": "Cliente creado correctamente"}


# =============================================================================
# ENDPOINT: PUT /{cliente_id}
# =============================================================================

@router.put("/{cliente_id}")
async def editar_cliente(
    cliente_id: str,
    datos: ClienteCrear,
    db: AsyncSession = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Edita datos del cliente. Valida CUIT y unicidad excluyendo el propio."""
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")

    if datos.cuit and datos.cuit.strip():
        cuit_limpio = datos.cuit.replace("-", "").replace(" ", "").strip()
        if not validar_cuit(cuit_limpio):
            raise HTTPException(400, f"El CUIT '{datos.cuit}' no es válido")
        dup = await db.execute(text(
            "SELECT id FROM clientes WHERE cuit = :c AND activo = TRUE AND id != :id"
        ), {"c": cuit_limpio, "id": cliente_id})
        if dup.fetchone():
            raise HTTPException(400, f"Ya existe otro cliente con el CUIT {datos.cuit}")
        c.cuit = cuit_limpio
    else:
        c.cuit = None

    c.razon_social           = datos.razon_social
    c.email                  = datos.email
    c.telefono               = datos.telefono
    c.direccion              = datos.direccion
    c.localidad              = datos.localidad
    c.provincia              = datos.provincia
    c.notas                  = datos.notas
    c.responsable_interno_id = datos.responsable_interno_id or None
    await db.flush()
    return {"mensaje": "Cliente actualizado correctamente"}


# =============================================================================
# ENDPOINT: PUT /{cliente_id}/desactivar
# =============================================================================

@router.put("/{cliente_id}/desactivar")
async def desactivar_cliente(
    cliente_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Baja lógica de un cliente (activo=FALSE)."""
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    c.activo = False
    c.fecha_baja = date.today()
    await db.flush()
    return {"mensaje": "Cliente desactivado correctamente"}


# =============================================================================
# ENDPOINT: PUT /{cliente_id}/reactivar
# =============================================================================

@router.put("/{cliente_id}/reactivar")
async def reactivar_cliente(
    cliente_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Reactiva un cliente desactivado."""
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    c.activo = True
    c.fecha_baja = None
    await db.flush()
    return {"mensaje": "Cliente reactivado correctamente"}


# =============================================================================
# ENDPOINT: GET /{cliente_id}/servicios
# Incluye fecha_fin, notas y estado vigente calculado
# =============================================================================

@router.get("/{cliente_id}/servicios")
async def servicios_del_cliente(
    cliente_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Lista todos los servicios de un cliente (activos e inactivos por fecha_fin).
      Calcula el campo 'vigente' server-side: activo=TRUE y fecha_fin nula o futura.
    DESCRIPCIÓN TÉCNICA:
      Incluye fecha_fin y notas de la asignación. El frontend usa 'vigente'
      para distinguir servicios activos de los dados de baja por fecha.
    """
    hoy = date.today()
    result = await db.execute(text("""
        SELECT
            cs.id         AS asignacion_id,
            s.id          AS servicio_id,
            s.nombre,
            s.codigo,
            cs.fecha_inicio,
            cs.fecha_fin,
            cs.notas      AS notas_asignacion,
            cs.activo,
            /* Vigente: activo Y sin fecha_fin O fecha_fin futura */
            (cs.activo = TRUE AND (cs.fecha_fin IS NULL OR cs.fecha_fin >= :hoy)) AS vigente
        FROM cliente_servicios cs
        JOIN servicios s ON cs.servicio_id = s.id
        WHERE cs.cliente_id = :cid AND cs.activo = TRUE
        ORDER BY vigente DESC, s.nombre
    """), {"cid": cliente_id, "hoy": hoy})

    return [
        {
            "asignacion_id":    str(r.asignacion_id),
            "servicio_id":      str(r.servicio_id),
            "nombre":           r.nombre,
            "codigo":           r.codigo,
            "fecha_inicio":     r.fecha_inicio.isoformat() if r.fecha_inicio else None,
            "fecha_fin":        r.fecha_fin.isoformat() if r.fecha_fin else None,
            "notas_asignacion": r.notas_asignacion,
            "activo":           r.activo,
            "vigente":          bool(r.vigente),
        }
        for r in result.fetchall()
    ]


# =============================================================================
# ENDPOINT: POST /{cliente_id}/servicios
# Asigna un servicio con fecha_fin y notas opcionales
# =============================================================================

@router.post("/{cliente_id}/servicios", status_code=201)
async def asignar_servicio(
    cliente_id: str,
    datos: ClienteServicioAsignar,
    db: AsyncSession = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Asigna un servicio al cliente con fecha_inicio, fecha_fin y notas opcionales.
      Si existía una asignación inactiva, la reactiva actualizando las fechas.
    DESCRIPCIÓN TÉCNICA:
      ON CONFLICT via lógica Python: busca existente activo o inactivo antes de insertar.
    """
    cli = await db.execute(text(
        "SELECT id FROM clientes WHERE id = :id AND activo = TRUE"
    ), {"id": cliente_id})
    if not cli.fetchone():
        raise HTTPException(404, "Cliente no encontrado")

    svc = await db.execute(text(
        "SELECT id FROM servicios WHERE id = :id AND activo = TRUE"
    ), {"id": datos.servicio_id})
    if not svc.fetchone():
        raise HTTPException(404, "Servicio no encontrado")

    # Verificar asignación activa duplicada
    ya = await db.execute(text("""
        SELECT id FROM cliente_servicios
        WHERE cliente_id = :cid AND servicio_id = :sid AND activo = TRUE
    """), {"cid": cliente_id, "sid": datos.servicio_id})
    if ya.fetchone():
        raise HTTPException(400, "Este servicio ya está asignado al cliente")

    # Verificar si existe inactiva para reactivar
    inact = await db.execute(text("""
        SELECT id FROM cliente_servicios
        WHERE cliente_id = :cid AND servicio_id = :sid AND activo = FALSE
    """), {"cid": cliente_id, "sid": datos.servicio_id})
    existente = inact.fetchone()

    if existente:
        await db.execute(text("""
            UPDATE cliente_servicios
            SET activo = TRUE, fecha_inicio = :inicio, fecha_fin = :fin, notas = :notas
            WHERE id = :id
        """), {
            "inicio": datos.fecha_inicio, "fin": datos.fecha_fin,
            "notas":  datos.notas, "id": str(existente.id),
        })
    else:
        await db.execute(text("""
            INSERT INTO cliente_servicios
                (id, cliente_id, servicio_id, fecha_inicio, fecha_fin, notas, activo, creado_en, creado_por)
            VALUES
                (:id, :cid, :sid, :inicio, :fin, :notas, TRUE, NOW(), :quien)
        """), {
            "id":    str(uuid.uuid4()),
            "cid":   cliente_id,
            "sid":   datos.servicio_id,
            "inicio": datos.fecha_inicio,
            "fin":   datos.fecha_fin,
            "notas": datos.notas,
            "quien": str(usuario_actual.id),
        })

    await db.flush()
    return {"mensaje": "Servicio asignado correctamente"}


# =============================================================================
# ENDPOINT: PATCH /{cliente_id}/servicios/{servicio_id}
# Actualiza fecha_fin y notas de una asignación (baja por fecha)
# =============================================================================

@router.put("/{cliente_id}/servicios/{servicio_id}")
async def actualizar_servicio_asignado(
    cliente_id: str,
    servicio_id: str,
    datos: ClienteServicioBaja,
    db: AsyncSession = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Actualiza la fecha_fin y notas de la asignación de un servicio a un cliente.
      Si fecha_fin tiene valor → el servicio queda dado de baja a esa fecha.
      Si fecha_fin es None → se limpia la fecha de baja (servicio queda vigente).
    DESCRIPCIÓN TÉCNICA:
      UPDATE directo en cliente_servicios filtrando por cliente_id y servicio_id.
    """
    existe = await db.execute(text("""
        SELECT id FROM cliente_servicios
        WHERE cliente_id = :cid AND servicio_id = :sid AND activo = TRUE
    """), {"cid": cliente_id, "sid": servicio_id})
    if not existe.fetchone():
        raise HTTPException(404, "Asignación no encontrada")

    await db.execute(text("""
        UPDATE cliente_servicios
        SET fecha_fin = :fin, notas = COALESCE(:notas, notas)
        WHERE cliente_id = :cid AND servicio_id = :sid AND activo = TRUE
    """), {
        "fin":   datos.fecha_fin,
        "notas": datos.notas,
        "cid":   cliente_id,
        "sid":   servicio_id,
    })
    await db.flush()
    return {"mensaje": "Asignación actualizada correctamente"}


# =============================================================================
# ENDPOINT: DELETE /{cliente_id}/servicios/{servicio_id}
# Baja lógica completa (activo=FALSE)
# =============================================================================

@router.delete("/{cliente_id}/servicios/{servicio_id}")
async def quitar_servicio(
    cliente_id: str,
    servicio_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """
    DESCRIPCIÓN FUNCIONAL: Elimina la asignación del servicio al cliente (baja lógica).
    DESCRIPCIÓN TÉCNICA: UPDATE activo=FALSE. Diferente de fecha_fin: esto
      desvincula definitivamente; fecha_fin solo marca el período de vigencia.
    """
    await db.execute(text("""
        UPDATE cliente_servicios SET activo = FALSE
        WHERE cliente_id = :cid AND servicio_id = :sid AND activo = TRUE
    """), {"cid": cliente_id, "sid": servicio_id})
    await db.flush()
    return {"mensaje": "Servicio quitado del cliente"}