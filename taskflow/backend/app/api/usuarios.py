"""
=============================================================
Archivo: usuarios.py
-------------------------------------------------------------
DESCRIPCIÓN FUNCIONAL:
  API REST para gestión de usuarios del sistema.
  Permite listar, crear, editar perfiles, desactivar y reactivar usuarios.
  Los usuarios acceden con Google OAuth; aquí se pre-registran sus emails
  y se les asignan perfiles (operador, supervisor, dueño, administrador).

DESCRIPCIÓN TÉCNICA:
  Router FastAPI con SQLAlchemy async (psycopg).
  Los perfiles se gestionan en la tabla usuario_perfiles (relación N:M).
  Al editar perfiles se hace baja lógica de los existentes y alta de los nuevos.
  Todos los endpoints requieren usuario autenticado.
=============================================================
"""

# ── Importaciones ────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException          # Framework y utilidades
from sqlalchemy.ext.asyncio import AsyncSession                # Sesión async
from sqlalchemy import select, text                            # Consultas ORM y SQL crudo
from pydantic import BaseModel                                 # Validación de modelos
from typing import Optional                                    # Tipos opcionales
from datetime import date                                      # Fechas de alta/baja

from app.core.database import get_db                           # Dependencia de sesión de BD
from app.api.auth import obtener_usuario_actual, obtener_empresa_id  # Dependencia de autenticación
from app.models.usuario import Usuario, UsuarioPerfil, Perfil, SupervisorOperador  # Modelos ORM

router = APIRouter()


# =============================================================================
# MODELOS PYDANTIC
# =============================================================================

class UsuarioCrear(BaseModel):
    """
    DESCRIPCIÓN FUNCIONAL: Esquema para crear un nuevo usuario.
    DESCRIPCIÓN TÉCNICA: email es el identificador de login con Google.
    """
    email: str                              # Email de Google del usuario
    nombre: str                             # Nombre del usuario
    apellido: str                           # Apellido del usuario
    perfiles: list[str] = ["operador"]      # Lista de códigos de perfil
    horario_inicio: Optional[str] = None    # Hora de inicio de jornada (HH:MM)
    horario_fin: Optional[str] = None       # Hora de fin de jornada (HH:MM)


class UsuarioEditarPerfiles(BaseModel):
    """
    DESCRIPCIÓN FUNCIONAL: Esquema para editar los perfiles de un usuario.
    DESCRIPCIÓN TÉCNICA: Reemplaza todos los perfiles actuales con los nuevos.
    """
    perfiles: list[str]   # Lista de códigos de perfil a asignar


# =============================================================================
# FUNCIÓN AUXILIAR: obtener_perfiles_usuario
# =============================================================================

async def obtener_perfiles_usuario(db: AsyncSession, usuario_id: str) -> list[str]:
    """
    DESCRIPCIÓN FUNCIONAL:
      Retorna los códigos de perfil activos de un usuario.
    DESCRIPCIÓN TÉCNICA:
      JOIN entre usuario_perfiles y perfiles, filtrando por activo=TRUE.
    """
    result = await db.execute(text("""
        SELECT p.codigo
        FROM usuario_perfiles up
        JOIN perfiles p ON up.perfil_id = p.id
        WHERE up.usuario_id = :uid AND up.activo = TRUE
    """), {"uid": usuario_id})
    return [row.codigo for row in result.fetchall()]


# =============================================================================
# ENDPOINT: GET /
# Lista todos los usuarios con sus perfiles
# =============================================================================

@router.get("/")
async def listar_usuarios(
    activo: bool = True,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    empresa_id: str = Depends(obtener_empresa_id),
    db: AsyncSession = Depends(get_db)
):
    """Lista usuarios de la empresa activa con sus perfiles."""
    if empresa_id:
        # Solo usuarios asignados a esta empresa
        result = await db.execute(text("""
            SELECT u.id, u.email, u.nombre, u.apellido, u.foto_url, u.activo
            FROM usuarios u
            JOIN usuario_empresas ue ON ue.usuario_id = u.id
            WHERE ue.empresa_id = :eid AND ue.activo = TRUE
              AND u.activo = :activo
            ORDER BY u.apellido, u.nombre
        """), {"eid": empresa_id, "activo": activo})
        filas = result.fetchall()
    else:
        result = await db.execute(
            select(Usuario)
            .where(Usuario.activo == activo)
            .order_by(Usuario.apellido, Usuario.nombre)
        )
        filas = result.scalars().all()

    # Cargar empresas de todos los usuarios en una sola consulta
    emp_rows = await db.execute(text("""
        SELECT ue.usuario_id::TEXT, e.id::TEXT AS empresa_id,
               e.nombre, e.color_primario
        FROM usuario_empresas ue
        JOIN empresas e ON ue.empresa_id = e.id
        WHERE ue.activo = TRUE
    """))
    empresas_por_usuario: dict = {}
    for er in emp_rows.fetchall():
        uid = str(er.usuario_id)
        if uid not in empresas_por_usuario:
            empresas_por_usuario[uid] = []
        empresas_por_usuario[uid].append({
            "id": str(er.empresa_id),
            "nombre": er.nombre,
            "color": er.color_primario or "#6366f1",
        })

    lista = []
    for u in filas:
        uid = str(u.id)
        perfiles = await obtener_perfiles_usuario(db, uid)
        lista.append({
            "id":       uid,
            "email":    u.email,
            "nombre":   u.nombre,
            "apellido": u.apellido,
            "foto_url": u.foto_url,
            "activo":   u.activo,
            "perfiles": perfiles,
            "empresas": empresas_por_usuario.get(uid, []),
        })
    return lista


# =============================================================================
# ENDPOINT: POST /
# Crea un nuevo usuario y le asigna perfiles
# =============================================================================

@router.post("/", status_code=201)
async def crear_usuario(
    datos: UsuarioCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    empresa_id: str = Depends(obtener_empresa_id),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Registra un nuevo usuario en la lista blanca del sistema.
      Al hacer login con Google, el sistema busca el email aquí.
      Asigna los perfiles indicados.
    DESCRIPCIÓN TÉCNICA:
      Verifica que el email no esté ya registrado antes de crear.
      Inserta en usuario_perfiles por cada perfil indicado.
    """
    # Verificar que el email no esté ya registrado
    dup = await db.execute(select(Usuario).where(Usuario.email == datos.email))
    if dup.scalar_one_or_none():
        raise HTTPException(400, f"Ya existe un usuario con el email '{datos.email}'")

    # Crear el objeto Usuario
    usuario = Usuario(
        email=datos.email,
        nombre=datos.nombre,
        apellido=datos.apellido,
        activo=True,
        fecha_alta=date.today(),
        creado_por=usuario_actual.id,
    )
    db.add(usuario)
    await db.flush()  # Para obtener el ID generado antes de asignar perfiles

    # Asignar cada perfil indicado
    for codigo_perfil in datos.perfiles:
        result = await db.execute(
            select(Perfil).where(Perfil.codigo == codigo_perfil)
        )
        perfil = result.scalar_one_or_none()
        if perfil:
            up = UsuarioPerfil(
                usuario_id=usuario.id,
                perfil_id=perfil.id,
                activo=True,
                fecha_alta=date.today(),
                asignado_por=usuario_actual.id,
            )
            db.add(up)

    await db.flush()

    # Asignar automáticamente el usuario a la empresa activa del creador
    if empresa_id:
        import uuid as _uuid
        await db.execute(text("""
            INSERT INTO usuario_empresas (id, usuario_id, empresa_id, activo, fecha_alta, creado_en)
            VALUES (:id, :uid, :eid, TRUE, CURRENT_DATE, NOW())
            ON CONFLICT (usuario_id, empresa_id) DO NOTHING
        """), {"id": str(_uuid.uuid4()), "uid": str(usuario.id), "eid": empresa_id})
        await db.flush()

    return {"id": str(usuario.id), "mensaje": "Usuario creado correctamente"}


# =============================================================================
# ENDPOINT: PUT /{usuario_id}/perfiles
# Reemplaza los perfiles de un usuario
# =============================================================================

@router.put("/{usuario_id}/perfiles")
async def editar_perfiles_usuario(
    usuario_id: str,
    datos: UsuarioEditarPerfiles,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Reemplaza todos los perfiles activos de un usuario con los nuevos.
      Perfiles removidos quedan con activo=FALSE (baja lógica).
      Perfiles nuevos se insertan como activos.
    DESCRIPCIÓN TÉCNICA:
      1. Desactiva todos los perfiles actuales del usuario
      2. Para cada perfil nuevo: si ya existía (inactivo) lo reactiva,
         si no existía lo crea. Así se preserva el historial.
    """
    if not datos.perfiles:
        raise HTTPException(400, "Debe asignar al menos un perfil")

    # Verificar que el usuario exista
    result = await db.execute(select(Usuario).where(Usuario.id == usuario_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")

    # Paso 1: Desactivar todos los perfiles actuales
    await db.execute(text("""
        UPDATE usuario_perfiles SET activo = FALSE
        WHERE usuario_id = :uid
    """), {"uid": usuario_id})

    # Paso 2: Activar o crear cada perfil nuevo
    for codigo_perfil in datos.perfiles:
        # Obtener el ID del perfil por su código
        result_perfil = await db.execute(
            select(Perfil).where(Perfil.codigo == codigo_perfil)
        )
        perfil = result_perfil.scalar_one_or_none()
        if not perfil:
            continue  # Ignorar códigos de perfil inválidos

        # Verificar si ya existe el registro (activo o no)
        result_up = await db.execute(text("""
            SELECT id FROM usuario_perfiles
            WHERE usuario_id = :uid AND perfil_id = :pid
        """), {"uid": usuario_id, "pid": str(perfil.id)})
        existente = result_up.fetchone()

        if existente:
            # Ya existe: reactivarlo
            await db.execute(text("""
                UPDATE usuario_perfiles SET activo = TRUE, fecha_alta = :hoy, asignado_por = :quien
                WHERE usuario_id = :uid AND perfil_id = :pid
            """), {"hoy": date.today(), "quien": str(usuario_actual.id),
                   "uid": usuario_id, "pid": str(perfil.id)})
        else:
            # No existe: crear nuevo registro
            up = UsuarioPerfil(
                usuario_id=usuario.id if False else usuario_id,
                perfil_id=perfil.id,
                activo=True,
                fecha_alta=date.today(),
                asignado_por=usuario_actual.id,
            )
            # Usar SQL directo para evitar problema con UUID str vs UUID obj
            await db.execute(text("""
                INSERT INTO usuario_perfiles (usuario_id, perfil_id, activo, fecha_alta, asignado_por)
                VALUES (:uid, :pid, TRUE, :hoy, :quien)
            """), {"uid": usuario_id, "pid": str(perfil.id),
                   "hoy": date.today(), "quien": str(usuario_actual.id)})

    await db.flush()
    return {"mensaje": "Perfiles actualizados correctamente"}


# =============================================================================
# ENDPOINT: PUT /{usuario_id}/desactivar
# Baja lógica de un usuario
# =============================================================================

@router.put("/{usuario_id}/desactivar")
async def desactivar_usuario(
    usuario_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Desactiva un usuario: no podrá hacer login aunque tenga cuenta de Google.
    DESCRIPCIÓN TÉCNICA:
      Actualiza flag activo=False y registra fecha de baja.
    """
    result = await db.execute(select(Usuario).where(Usuario.id == usuario_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")

    u.activo     = False          # Marcar como inactivo
    u.fecha_baja = date.today()   # Registrar fecha de baja
    await db.flush()
    return {"mensaje": "Usuario desactivado"}


# =============================================================================
# ENDPOINT: PUT /{usuario_id}/reactivar
# Reactiva un usuario desactivado
# =============================================================================

@router.put("/{usuario_id}/reactivar")
async def reactivar_usuario(
    usuario_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Reactiva un usuario desactivado: podrá volver a hacer login.
    DESCRIPCIÓN TÉCNICA:
      Actualiza flag activo=True y limpia la fecha de baja.
    """
    result = await db.execute(select(Usuario).where(Usuario.id == usuario_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")

    u.activo     = True    # Reactivar
    u.fecha_baja = None    # Limpiar fecha de baja
    await db.flush()
    return {"mensaje": "Usuario reactivado"}


async def _obtener_perfiles_usuario(usuario_id, db):
       from sqlalchemy import text as sqlt
       result = await db.execute(sqlt("""
           SELECT p.codigo FROM perfiles p
           JOIN usuario_perfiles up ON up.perfil_id = p.id
           WHERE up.usuario_id = :uid AND up.activo = TRUE
       """), {"uid": str(usuario_id)})
       return [r.codigo for r in result.fetchall()]


# =============================================================================
# ENDPOINT: GET /{usuario_id}/supervisores
# Lista los supervisores asignados a un operador
# =============================================================================

@router.get("/{usuario_id}/supervisores")
async def obtener_supervisores(
    usuario_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCIÓN FUNCIONAL:
      Retorna los supervisores asignados a un operador específico.
    DESCRIPCIÓN TÉCNICA:
      JOIN entre usuarios y supervisor_operador filtrando por operador_id.
    """
    result = await db.execute(
        select(Usuario)
        .join(SupervisorOperador, SupervisorOperador.supervisor_id == Usuario.id)
        .where(
            SupervisorOperador.operador_id == usuario_id,
            SupervisorOperador.activo == True
        )
    )
    supervisores = result.scalars().all()
    return [{"id": str(s.id), "nombre": s.nombre + " " + s.apellido} for s in supervisores]

"""
=============================================================
Versión: v1.0.0
-------------------------------------------------------------
DESCRIPCION FUNCIONAL:
  Endpoints para gestionar la relación supervisor-operador.
  GET  /usuarios/supervisores-operadores  → lista todas las relaciones
  POST /usuarios/supervisores-operadores  → asignar supervisor a operador
  DELETE /usuarios/supervisores-operadores/{id} → quitar relación
=============================================================
"""

@router.get("/supervisores-operadores")
async def listar_supervisores_operadores(
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Lista todas las relaciones supervisor-operador activas.
      Solo administradores y dueños.
    """
    from sqlalchemy import text as sqlt
    perfiles = await _obtener_perfiles_usuario(usuario_actual.id, db)
    if "administrador" not in perfiles and "dueno" not in perfiles:
        raise HTTPException(403, "Solo administradores pueden ver esta información")

    result = await db.execute(sqlt("""
        SELECT
            so.id,
            so.supervisor_id,
            so.operador_id,
            so.activo,
            so.fecha_inicio,
            us.nombre || ' ' || us.apellido AS supervisor_nombre,
            uo.nombre || ' ' || uo.apellido AS operador_nombre
        FROM supervisor_operador so
        JOIN usuarios us ON so.supervisor_id = us.id
        JOIN usuarios uo ON so.operador_id   = uo.id
        WHERE so.activo = TRUE
        ORDER BY us.apellido, uo.apellido
    """))
    return [
        {
            "id":                str(r.id),
            "supervisor_id":     str(r.supervisor_id),
            "supervisor_nombre": r.supervisor_nombre,
            "operador_id":       str(r.operador_id),
            "operador_nombre":   r.operador_nombre,
            "fecha_inicio":      r.fecha_inicio.isoformat() if r.fecha_inicio else None,
        }
        for r in result.fetchall()
    ]


class AsignarSupervisorRequest(BaseModel):
    supervisor_id: str
    operador_id:   str


@router.post("/supervisores-operadores", status_code=201)
async def asignar_supervisor(
    datos: AsignarSupervisorRequest,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Asigna un supervisor a un operador.
      Valida que no sea la misma persona y que no exista ya la relación.
    """
    from sqlalchemy import text as sqlt
    import uuid as uuid_mod
    from datetime import date

    perfiles = await _obtener_perfiles_usuario(usuario_actual.id, db)
    if "administrador" not in perfiles and "dueno" not in perfiles:
        raise HTTPException(403, "Solo administradores pueden asignar supervisores")

    if datos.supervisor_id == datos.operador_id:
        raise HTTPException(400, "El supervisor y el operador no pueden ser la misma persona")

    # Verificar si ya existe
    dup = await db.execute(sqlt("""
        SELECT id FROM supervisor_operador
        WHERE supervisor_id = :sid AND operador_id = :oid AND activo = TRUE
    """), {"sid": datos.supervisor_id, "oid": datos.operador_id})
    if dup.fetchone():
        raise HTTPException(400, "Esta relación supervisor-operador ya existe")

    nuevo_id = str(uuid_mod.uuid4())
    await db.execute(sqlt("""
        INSERT INTO supervisor_operador
            (id, supervisor_id, operador_id, activo, fecha_inicio, creado_en)
        VALUES (:id, :sid, :oid, TRUE, :hoy, NOW())
    """), {
        "id":  nuevo_id,
        "sid": datos.supervisor_id,
        "oid": datos.operador_id,
        "hoy": date.today(),
    })
    return {"id": nuevo_id, "mensaje": "Relación supervisor-operador creada"}


@router.delete("/supervisores-operadores/{relacion_id}")
async def quitar_supervisor(
    relacion_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Desactiva una relación supervisor-operador (baja lógica).
    """
    from sqlalchemy import text as sqlt
    from datetime import date

    perfiles = await _obtener_perfiles_usuario(usuario_actual.id, db)
    if "administrador" not in perfiles and "dueno" not in perfiles:
        raise HTTPException(403, "Solo administradores pueden quitar supervisores")

    await db.execute(sqlt("""
        UPDATE supervisor_operador
        SET activo = FALSE, fecha_fin = :hoy
        WHERE id = :id
    """), {"id": relacion_id, "hoy": date.today()})
    return {"mensaje": "Relación eliminada"}

"""
=============================================================
Versión: v1.0.0
-------------------------------------------------------------
DESCRIPCION FUNCIONAL:
  Endpoints para gestionar la relación supervisor-operador.
  GET  /usuarios/supervisores-operadores  → lista todas las relaciones
  POST /usuarios/supervisores-operadores  → asignar supervisor a operador
  DELETE /usuarios/supervisores-operadores/{id} → quitar relación
=============================================================
"""

@router.get("/supervisores-operadores")
async def listar_supervisores_operadores(
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Lista todas las relaciones supervisor-operador activas.
      Solo administradores y dueños.
    """
    from sqlalchemy import text as sqlt
    perfiles = await _obtener_perfiles_usuario(usuario_actual.id, db)
    if "administrador" not in perfiles and "dueno" not in perfiles:
        raise HTTPException(403, "Solo administradores pueden ver esta información")

    result = await db.execute(sqlt("""
        SELECT
            so.id,
            so.supervisor_id,
            so.operador_id,
            so.activo,
            so.fecha_inicio,
            us.nombre || ' ' || us.apellido AS supervisor_nombre,
            uo.nombre || ' ' || uo.apellido AS operador_nombre
        FROM supervisor_operador so
        JOIN usuarios us ON so.supervisor_id = us.id
        JOIN usuarios uo ON so.operador_id   = uo.id
        WHERE so.activo = TRUE
        ORDER BY us.apellido, uo.apellido
    """))
    return [
        {
            "id":                str(r.id),
            "supervisor_id":     str(r.supervisor_id),
            "supervisor_nombre": r.supervisor_nombre,
            "operador_id":       str(r.operador_id),
            "operador_nombre":   r.operador_nombre,
            "fecha_inicio":      r.fecha_inicio.isoformat() if r.fecha_inicio else None,
        }
        for r in result.fetchall()
    ]


class AsignarSupervisorRequest(BaseModel):
    supervisor_id: str
    operador_id:   str


@router.post("/supervisores-operadores", status_code=201)
async def asignar_supervisor(
    datos: AsignarSupervisorRequest,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Asigna un supervisor a un operador.
      Valida que no sea la misma persona y que no exista ya la relación.
    """
    from sqlalchemy import text as sqlt
    import uuid as uuid_mod
    from datetime import date

    perfiles = await _obtener_perfiles_usuario(usuario_actual.id, db)
    if "administrador" not in perfiles and "dueno" not in perfiles:
        raise HTTPException(403, "Solo administradores pueden asignar supervisores")

    if datos.supervisor_id == datos.operador_id:
        raise HTTPException(400, "El supervisor y el operador no pueden ser la misma persona")

    # Verificar si ya existe
    dup = await db.execute(sqlt("""
        SELECT id FROM supervisor_operador
        WHERE supervisor_id = :sid AND operador_id = :oid AND activo = TRUE
    """), {"sid": datos.supervisor_id, "oid": datos.operador_id})
    if dup.fetchone():
        raise HTTPException(400, "Esta relación supervisor-operador ya existe")

    nuevo_id = str(uuid_mod.uuid4())
    await db.execute(sqlt("""
        INSERT INTO supervisor_operador
            (id, supervisor_id, operador_id, activo, fecha_inicio, creado_en)
        VALUES (:id, :sid, :oid, TRUE, :hoy, NOW())
    """), {
        "id":  nuevo_id,
        "sid": datos.supervisor_id,
        "oid": datos.operador_id,
        "hoy": date.today(),
    })
    return {"id": nuevo_id, "mensaje": "Relación supervisor-operador creada"}


@router.delete("/supervisores-operadores/{relacion_id}")
async def quitar_supervisor(
    relacion_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Desactiva una relación supervisor-operador (baja lógica).
    """
    from sqlalchemy import text as sqlt
    from datetime import date

    perfiles = await _obtener_perfiles_usuario(usuario_actual.id, db)
    if "administrador" not in perfiles and "dueno" not in perfiles:
        raise HTTPException(403, "Solo administradores pueden quitar supervisores")

    await db.execute(sqlt("""
        UPDATE supervisor_operador
        SET activo = FALSE, fecha_fin = :hoy
        WHERE id = :id
    """), {"id": relacion_id, "hoy": date.today()})
    return {"mensaje": "Relación eliminada"}