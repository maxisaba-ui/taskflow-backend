"""
Autenticación con Google OAuth 2.0 + JWT interno
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from jose import JWTError, jwt
from datetime import datetime, timedelta
import pytz

from app.core.config import settings
from app.core.database import get_db
from app.models.usuario import Usuario, UsuarioPerfil, Perfil, Sesion
from pydantic import BaseModel
from typing import Optional
import hashlib
import secrets

router = APIRouter()
security = HTTPBearer()
TZ = pytz.timezone(settings.TIMEZONE)


class GoogleTokenRequest(BaseModel):
    token: str  # El token que Google entrega al usuario


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: dict


def crear_jwt(usuario_id: str, empresa_id: str = None) -> str:
    """
    Crea un token JWT para el usuario.
    Incluye empresa_id para el filtrado multi-empresa en todos los endpoints.
    """
    ahora = datetime.now(TZ)
    expira = ahora + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub":        str(usuario_id),
        "empresa_id": str(empresa_id) if empresa_id else None,
        "iat":        ahora,
        "exp":        expira,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def obtener_usuario_actual(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Usuario:
    """
    Dependency: verifica el JWT y devuelve el usuario actual.
    Se usa en todos los endpoints protegidos.
    """
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        usuario_id: str  = payload.get("sub")
        empresa_id: str  = payload.get("empresa_id")
        if usuario_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    
    # Verificar sesión activa
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await db.execute(
        select(Sesion).where(
            Sesion.token_hash == token_hash,
            Sesion.activa == True,
            Sesion.expira_en > datetime.now(TZ)
        )
    )
    sesion = result.scalar_one_or_none()
    if not sesion:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    
    # Obtener usuario
    result = await db.execute(
        select(Usuario).where(Usuario.id == usuario_id, Usuario.activo == True)
    )
    usuario = result.scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")
    
    return usuario


@router.post("/google", response_model=LoginResponse)
async def login_con_google(
    request: GoogleTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    1. Recibe el token de Google desde el frontend
    2. Verifica que sea válido con Google
    3. Verifica que el email esté en la lista blanca del sistema
    4. Devuelve un JWT propio del sistema
    """
    # Verificar el token con Google
    try:
        google_info = id_token.verify_oauth2_token(
            request.token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token de Google inválido: {str(e)}"
        )
    
    email = google_info.get("email")
    google_id = google_info.get("sub")
    nombre = google_info.get("given_name", "")
    apellido = google_info.get("family_name", "")
    foto_url = google_info.get("picture", "")
    
    # Buscar usuario en lista blanca del sistema
    result = await db.execute(
        select(Usuario).where(Usuario.email == email, Usuario.activo == True)
    )
    usuario = result.scalar_one_or_none()
    
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu email no está registrado en el sistema. Contactá al administrador."
        )
    
    # Actualizar datos de Google si cambiaron
    if usuario.google_id != google_id:
        usuario.google_id = google_id
    if foto_url:
        usuario.foto_url = foto_url
    usuario.ultimo_login = datetime.now(TZ)
    await db.flush()
    
    # Crear JWT
    # Obtener empresa activa del usuario (la primera que tenga)
    from sqlalchemy import text as sqlt
    emp_result = await db.execute(sqlt("""
        SELECT empresa_id FROM usuario_empresas
        WHERE usuario_id = :uid AND activo = TRUE
        ORDER BY fecha_alta LIMIT 1
    """), {"uid": str(usuario.id)})
    emp_row    = emp_result.fetchone()
    empresa_id = str(emp_row.empresa_id) if emp_row else None
    access_token = crear_jwt(str(usuario.id), empresa_id)
    
    # Registrar sesión
    token_hash = hashlib.sha256(access_token.encode()).hexdigest()
    sesion = Sesion(
        usuario_id=usuario.id,
        token_hash=token_hash,
        expira_en=datetime.now(TZ) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    db.add(sesion)
    await db.flush()
    
    # Obtener perfiles del usuario
    result = await db.execute(
        select(Perfil.codigo)
        .join(UsuarioPerfil, UsuarioPerfil.perfil_id == Perfil.id)
        .where(
            UsuarioPerfil.usuario_id == usuario.id,
            UsuarioPerfil.activo == True
        )
    )
    perfiles = [row[0] for row in result.fetchall()]
    
    # Obtener datos de la empresa para incluirlos en la respuesta
    empresa_nombre  = None
    logo_url        = None
    color_primario  = "#6366f1"
    if empresa_id:
        emp_data = await db.execute(sqlt(
            "SELECT nombre, logo_url, color_primario FROM empresas WHERE id = :id"
        ), {"id": empresa_id})
        e = emp_data.fetchone()
        if e:
            empresa_nombre = e.nombre
            logo_url       = e.logo_url
            color_primario = e.color_primario or "#6366f1"

    return LoginResponse(
        access_token=access_token,
        usuario={
            "id":              str(usuario.id),
            "email":           usuario.email,
            "nombre":          usuario.nombre,
            "apellido":        usuario.apellido,
            "foto_url":        usuario.foto_url,
            "perfiles":        perfiles,
            "empresa_id":      empresa_id,
            "empresa_nombre":  empresa_nombre,
            "logo_url":        logo_url,
            "color_primario":  color_primario,
        }
    )


@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Cierra la sesión invalidando el token"""
    token = credentials.credentials
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    result = await db.execute(
        select(Sesion).where(Sesion.token_hash == token_hash)
    )
    sesion = result.scalar_one_or_none()
    if sesion:
        sesion.activa = False
        sesion.cerrado_en = datetime.now(TZ)
    
    return {"message": "Sesión cerrada correctamente"}


# =============================================================
# FIX: endpoint GET /auth/me en auth.py
# Versión: v1.0.1
# -------------------------------------------------------------
# DESCRIPCION FUNCIONAL:
#   Reemplazar el endpoint /me actual por esta versión que
#   incluye los perfiles del usuario en la respuesta.
#   Sin esto, al recargar con F5 el frontend pierde los perfiles
#   y todo el sistema de visibilidad por rol falla.
#
# INSTRUCCION:
#   En auth.py, reemplazar el bloque @router.get("/me") completo
#   (las últimas ~10 líneas del archivo) por este código:
# =============================================================
 
@router.get("/me")
async def mi_perfil(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Devuelve los datos completos del usuario autenticado,
      incluyendo perfiles activos. Se llama al recargar la app
      para restaurar el estado de sesion sin hacer login de nuevo.
    DESCRIPCION TECNICA:
      JOIN entre usuario_perfiles y perfiles para obtener los
      codigos de perfil activos. Sin esto, el frontend pierde
      los perfiles al recargar y el sistema de roles falla.
    """
    # Obtener perfiles activos del usuario autenticado
    result = await db.execute(
        select(Perfil.codigo)
        .join(UsuarioPerfil, UsuarioPerfil.perfil_id == Perfil.id)
        .where(
            UsuarioPerfil.usuario_id == usuario.id,
            UsuarioPerfil.activo == True
        )
    )
    perfiles = [row[0] for row in result.fetchall()]
 
    # Obtener datos de la empresa activa del token
    empresa_id      = None
    empresa_nombre  = None
    logo_url        = None
    color_primario  = "#6366f1"
    try:
        from fastapi import Request
        auth_header = credentials.credentials if hasattr(credentials, "credentials") else None
        if auth_header:
            decoded     = jwt.decode(auth_header, settings.SECRET_KEY,
                                     algorithms=[settings.ALGORITHM])
            empresa_id  = decoded.get("empresa_id")
        if empresa_id:
            from sqlalchemy import text as sqlt
            emp = await db.execute(sqlt(
                "SELECT nombre, logo_url, color_primario FROM empresas WHERE id = :id"
            ), {"id": empresa_id})
            e = emp.fetchone()
            if e:
                empresa_nombre = e.nombre
                logo_url       = e.logo_url
                color_primario = e.color_primario or "#6366f1"
    except Exception:
        pass

    return {
        "id":              str(usuario.id),
        "email":           usuario.email,
        "nombre":          usuario.nombre,
        "apellido":        usuario.apellido,
        "foto_url":        usuario.foto_url,
        "perfiles":        perfiles,
        "empresa_id":      empresa_id,
        "empresa_nombre":  empresa_nombre,
        "logo_url":        logo_url,
        "color_primario":  color_primario,
    }

@router.get("/mis-empresas")
async def mis_empresas(
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Lista las empresas a las que pertenece el usuario autenticado.
      El frontend usa esto para mostrar el selector de empresa.
    """
    from sqlalchemy import text as sqlt
    result = await db.execute(sqlt("""
        SELECT e.id, e.nombre, e.logo_url, e.icono_url,
               COALESCE(e.color_primario, '#6366f1') AS color_primario
        FROM usuario_empresas ue
        JOIN empresas e ON ue.empresa_id = e.id
        WHERE ue.usuario_id = :uid AND ue.activo = TRUE AND e.activa = TRUE
        ORDER BY e.nombre
    """), {"uid": str(usuario_actual.id)})
    return [
        {
            "id":             str(r.id),
            "nombre":         r.nombre,
            "logo_url":       r.logo_url,
            "icono_url":      r.icono_url,
            "color_primario": r.color_primario,
        }
        for r in result.fetchall()
    ]


class SeleccionarEmpresaRequest(BaseModel):
    empresa_id: str


@router.post("/seleccionar-empresa")
async def seleccionar_empresa(
    datos: SeleccionarEmpresaRequest,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Cambia la empresa activa del usuario generando un nuevo JWT
      con el empresa_id seleccionado. El frontend reemplaza el token
      en localStorage y recarga los datos con la nueva empresa.
    DESCRIPCION TECNICA:
      Verifica pertenencia en usuario_empresas antes de generar el token.
    """
    from sqlalchemy import text as sqlt
    check = await db.execute(sqlt("""
        SELECT e.nombre, e.logo_url,
               COALESCE(e.color_primario, '#6366f1') AS color_primario
        FROM usuario_empresas ue
        JOIN empresas e ON ue.empresa_id = e.id
        WHERE ue.usuario_id = :uid
          AND ue.empresa_id = :eid
          AND ue.activo = TRUE
          AND e.activa = TRUE
    """), {"uid": str(usuario_actual.id), "eid": datos.empresa_id})
    empresa = check.fetchone()
    if not empresa:
        raise HTTPException(403, "No tenés acceso a esa empresa")

    nuevo_token = crear_jwt(str(usuario_actual.id), datos.empresa_id)
    return {
        "access_token":   nuevo_token,
        "empresa_id":     datos.empresa_id,
        "empresa_nombre": empresa.nombre,
        "logo_url":       empresa.logo_url,
        "color_primario": empresa.color_primario,
    }

async def obtener_empresa_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """
    DESCRIPCION FUNCIONAL:
      Extrae el empresa_id del JWT del usuario autenticado.
      Se usa como dependencia en todos los endpoints que necesitan
      filtrar datos por empresa.
    DESCRIPCION TECNICA:
      Decodifica el token JWT y retorna empresa_id.
      Si no tiene empresa_id (token viejo), retorna None.
    """
    try:
        from jose import jwt as jose_jwt
        from app.core.config import settings
        token   = credentials.credentials
        payload = jose_jwt.decode(token, settings.SECRET_KEY,
                                  algorithms=[settings.ALGORITHM])
        return payload.get("empresa_id")
    except Exception:
        return None
