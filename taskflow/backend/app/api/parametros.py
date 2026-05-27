"""
=============================================================
Archivo: parametros.py
Versión: v1.1.0
-------------------------------------------------------------
DESCRIPCION FUNCIONAL:
  API REST para gestión de parámetros del sistema: empresa,
  feriados, catálogo de tareas y rubros.
  v1.1.0: catálogo incluye prioridad_default por tarea.

HISTORIAL:
  v1.0.0 - CRUD completo de empresa, feriados, catálogo, rubros.
  v1.1.0 - Agrega prioridad_default en CatalogoTareaCrear y
           en los endpoints GET/POST/PUT de catálogo.
=============================================================
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.api.auth import obtener_usuario_actual, obtener_empresa_id
from app.models.usuario import Usuario

router = APIRouter()


# =============================================================================
# MODELOS PYDANTIC
# =============================================================================

class EmpresaActualizar(BaseModel):
    nombre: Optional[str] = None
    logo_url: Optional[str] = None
    horario_inicio_default: Optional[str] = None
    horario_fin_default: Optional[str] = None
    email_notificaciones: Optional[str] = None
    zona_horaria: Optional[str] = None


class FeriadoCrear(BaseModel):
    fecha: date
    nombre: str
    tipo: str = "nacional"


class FeriadoDuplicarAnio(BaseModel):
    """Esquema para duplicar feriados de un año a otro."""
    anio_origen: int
    anio_destino: int


class CatalogoTareaCrear(BaseModel):
    """
    DESCRIPCION FUNCIONAL: Esquema para crear o editar tarea del catálogo.
    v1.1.0: agrega prioridad_default que se usa como prioridad inicial
    al agregar la tarea al calendario desde sugerencias o agenda.
    """
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    rubro_id: str
    duracion_estimada_minutos: Optional[int] = None
    requiere_cliente: bool = True
    es_compleja: bool = False
    prioridad_default: str = "media"   # urgente | alta | media | baja
    sla_horas_default: Optional[int] = None


# =============================================================================
# ENDPOINTS DE EMPRESA
# =============================================================================

@router.get("/empresa")
async def obtener_empresa(
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(text("""
        SELECT id, nombre, logo_url, icono_url, zona_horaria,
               horario_inicio_default::TEXT, horario_fin_default::TEXT,
               email_notificaciones
        FROM empresas WHERE activa = TRUE LIMIT 1
    """))
    empresa = result.fetchone()
    if not empresa:
        return {"nombre": "Mi Estudio Contable"}
    return {
        "id": str(empresa.id), "nombre": empresa.nombre,
        "logo_url": empresa.logo_url, "icono_url": empresa.icono_url,
        "zona_horaria": empresa.zona_horaria,
        "horario_inicio_default": empresa.horario_inicio_default,
        "horario_fin_default": empresa.horario_fin_default,
        "email_notificaciones": empresa.email_notificaciones,
    }


@router.put("/empresa")
async def actualizar_empresa(
    datos: EmpresaActualizar,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    campos = {k: v for k, v in datos.dict().items() if v is not None}
    if not campos:
        return {"mensaje": "Sin cambios"}
    set_clause = ", ".join(f"{k} = :{k}" for k in campos)
    await db.execute(text(f"""
        UPDATE empresas SET {set_clause}, actualizado_en = NOW()
        WHERE activa = TRUE
    """), campos)
    await db.flush()
    return {"mensaje": "Configuración guardada correctamente"}


# =============================================================================
# ENDPOINTS DE FERIADOS
# NOTA: /feriados/duplicar-anio va ANTES de /feriados/{id}
# =============================================================================

@router.get("/feriados")
async def listar_feriados(
    anio: Optional[int] = Query(default=None),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    if anio is None:
        anio = date.today().year
    result = await db.execute(text("""
        SELECT id, fecha, nombre, tipo, anio
        FROM feriados WHERE anio = :anio AND activo = TRUE ORDER BY fecha
    """), {"anio": anio})
    return [{"id": str(f.id), "fecha": f.fecha.isoformat(),
             "nombre": f.nombre, "tipo": f.tipo, "anio": f.anio}
            for f in result.fetchall()]


@router.post("/feriados", status_code=201)
async def crear_feriado(
    datos: FeriadoCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await db.execute(text("""
            INSERT INTO feriados (fecha, nombre, tipo, anio, activo, creado_en, creado_por)
            VALUES (:fecha, :nombre, :tipo, :anio, TRUE, NOW(), :creado_por)
            ON CONFLICT (fecha) DO UPDATE SET
                nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, activo = TRUE
            RETURNING id
        """), {"fecha": datos.fecha, "nombre": datos.nombre, "tipo": datos.tipo,
               "anio": datos.fecha.year, "creado_por": str(usuario_actual.id)})
        feriado_id = result.fetchone()[0]
        await db.flush()
    except Exception as e:
        raise HTTPException(400, f"Error al guardar feriado: {str(e)}")
    return {"id": str(feriado_id), "mensaje": "Feriado guardado"}


@router.post("/feriados/duplicar-anio")
async def duplicar_anio_feriados(
    datos: FeriadoDuplicarAnio,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Copia todos los feriados del año origen al año destino.
      Ajusta fechas (mismo dia/mes, año distinto). Maneja 29/Feb.
      No pisa feriados ya existentes en el año destino.
    """
    if datos.anio_origen == datos.anio_destino:
        raise HTTPException(400, "El año origen y el destino deben ser diferentes")

    result = await db.execute(text("""
        SELECT fecha, nombre, tipo FROM feriados
        WHERE anio = :anio AND activo = TRUE ORDER BY fecha
    """), {"anio": datos.anio_origen})
    feriados_origen = result.fetchall()

    if not feriados_origen:
        raise HTTPException(404, f"No hay feriados para el año {datos.anio_origen}")

    copiados = 0; omitidos = 0

    for f in feriados_origen:
        try:
            fecha_destino = f.fecha.replace(year=datos.anio_destino)
        except ValueError:
            fecha_destino = f.fecha.replace(year=datos.anio_destino, day=28)

        result_insert = await db.execute(text("""
            INSERT INTO feriados (fecha, nombre, tipo, anio, activo, creado_en, creado_por)
            VALUES (:fecha, :nombre, :tipo, :anio, TRUE, NOW(), :creado_por)
            ON CONFLICT (fecha) DO NOTHING
            RETURNING id
        """), {"fecha": fecha_destino, "nombre": f.nombre, "tipo": f.tipo,
               "anio": datos.anio_destino, "creado_por": str(usuario_actual.id)})
        if result_insert.fetchone():
            copiados += 1
        else:
            omitidos += 1

    await db.flush()
    return {"mensaje": f"{copiados} feriado(s) copiado(s) al año {datos.anio_destino}",
            "copiados": copiados, "omitidos": omitidos,
            "anio_origen": datos.anio_origen, "anio_destino": datos.anio_destino}


@router.put("/feriados/{feriado_id}")
async def editar_feriado(
    feriado_id: str,
    datos: FeriadoCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    existe = await db.execute(text(
        "SELECT id FROM feriados WHERE id = :id AND activo = TRUE"
    ), {"id": feriado_id})
    if not existe.fetchone():
        raise HTTPException(404, "Feriado no encontrado")

    dup = await db.execute(text(
        "SELECT id FROM feriados WHERE fecha = :fecha AND activo = TRUE AND id != :id"
    ), {"fecha": datos.fecha, "id": feriado_id})
    if dup.fetchone():
        raise HTTPException(400, f"Ya existe otro feriado en la fecha {datos.fecha}")

    await db.execute(text("""
        UPDATE feriados SET fecha = :fecha, nombre = :nombre,
        tipo = :tipo, anio = :anio WHERE id = :id
    """), {"fecha": datos.fecha, "nombre": datos.nombre,
           "tipo": datos.tipo, "anio": datos.fecha.year, "id": feriado_id})
    await db.flush()
    return {"mensaje": "Feriado actualizado correctamente"}


@router.delete("/feriados/{feriado_id}")
async def eliminar_feriado(
    feriado_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(text(
        "UPDATE feriados SET activo = FALSE WHERE id = :id"
    ), {"id": feriado_id})
    await db.flush()
    return {"mensaje": "Feriado eliminado"}


# =============================================================================
# ENDPOINTS DE CATÁLOGO DE TAREAS
# NOTA: incluye prioridad_default desde v1.1.0
# =============================================================================

@router.get("/catalogo")
async def listar_catalogo(
    activo: bool = Query(default=True),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Lista tareas del catálogo con prioridad_default incluida."""
    result = await db.execute(text("""
        SELECT ct.id, ct.codigo, ct.nombre, ct.descripcion,
               ct.duracion_estimada_minutos, ct.requiere_cliente,
               ct.es_compleja, ct.activo,
               COALESCE(ct.prioridad_default, 'media') AS prioridad_default,
               ct.sla_horas_default,
               rt.id AS rubro_id,
               rt.nombre AS rubro, rt.color_hex AS rubro_color
        FROM catalogo_tareas ct
        LEFT JOIN rubros_tarea rt ON ct.rubro_id = rt.id
        WHERE ct.activo = :activo
        ORDER BY rt.nombre, ct.nombre
    """), {"activo": activo})
    return [
        {
            "id":                        str(t.id),
            "codigo":                    t.codigo,
            "nombre":                    t.nombre,
            "descripcion":               t.descripcion,
            "duracion_estimada_minutos": t.duracion_estimada_minutos,
            "requiere_cliente":          t.requiere_cliente,
            "es_compleja":               t.es_compleja,
            "activo":                    t.activo,
            "prioridad_default":         t.prioridad_default,
            "sla_horas_default":       t.sla_horas_default,
            "rubro_id":                  str(t.rubro_id) if t.rubro_id else None,
            "rubro":                     t.rubro,
            "rubro_color":               t.rubro_color,
        }
        for t in result.fetchall()
    ]


@router.post("/catalogo", status_code=201)
async def crear_tarea_catalogo(
    datos: CatalogoTareaCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    dup = await db.execute(text(
        "SELECT id FROM catalogo_tareas WHERE codigo = :c AND activo = TRUE"
    ), {"c": datos.codigo.upper()})
    if dup.fetchone():
        raise HTTPException(400, f"Ya existe una tarea con el código '{datos.codigo}'")

    result = await db.execute(text("""
        INSERT INTO catalogo_tareas
            (codigo, nombre, descripcion, rubro_id, duracion_estimada_minutos, sla_horas_default,
             requiere_cliente, es_compleja, prioridad_default, activo,
             fecha_alta, creado_por)
        VALUES
            (:codigo, :nombre, :descripcion, :rubro_id, :duracion, :sla_default,
             :requiere_cliente, :es_compleja, :prioridad_default, TRUE,
             CURRENT_DATE, :creado_por)
        RETURNING id
    """), {
        "codigo":            datos.codigo.upper(),
        "nombre":            datos.nombre,
        "descripcion":       datos.descripcion,
        "rubro_id":          datos.rubro_id,
        "duracion":          datos.duracion_estimada_minutos,
        "requiere_cliente":  datos.requiere_cliente,
        "es_compleja":       datos.es_compleja,
        "prioridad_default": datos.prioridad_default,
        "sla_default":       datos.sla_horas_default,
        "creado_por":        str(usuario_actual.id),
    })
    nuevo_id = result.fetchone()[0]
    await db.flush()
    return {"id": str(nuevo_id), "mensaje": "Tarea agregada al catálogo"}


@router.put("/catalogo/{tarea_id}")
async def editar_tarea_catalogo(
    tarea_id: str,
    datos: CatalogoTareaCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    existe = await db.execute(text(
        "SELECT id FROM catalogo_tareas WHERE id = :id AND activo = TRUE"
    ), {"id": tarea_id})
    if not existe.fetchone():
        raise HTTPException(404, "Tarea no encontrada en el catálogo")

    dup = await db.execute(text(
        "SELECT id FROM catalogo_tareas WHERE codigo = :c AND activo = TRUE AND id != :id"
    ), {"c": datos.codigo.upper(), "id": tarea_id})
    if dup.fetchone():
        raise HTTPException(400, f"Ya existe otra tarea con el código '{datos.codigo}'")

    await db.execute(text("""
        UPDATE catalogo_tareas SET
            codigo                    = :codigo,
            nombre                    = :nombre,
            descripcion               = :descripcion,
            rubro_id                  = :rubro_id,
            duracion_estimada_minutos = :duracion,
            requiere_cliente          = :requiere_cliente,
            es_compleja               = :es_compleja,
            prioridad_default         = :prioridad_default,
            sla_horas_default         = :sla_default
        WHERE id = :id
    """), {
        "codigo":            datos.codigo.upper(),
        "nombre":            datos.nombre,
        "descripcion":       datos.descripcion,
        "rubro_id":          datos.rubro_id,
        "duracion":          datos.duracion_estimada_minutos,
        "requiere_cliente":  datos.requiere_cliente,
        "es_compleja":       datos.es_compleja,
        "prioridad_default": datos.prioridad_default,
        "sla_default":       datos.sla_horas_default,
        "id":                tarea_id,
    })
    await db.flush()
    return {"mensaje": "Tarea actualizada correctamente"}


@router.delete("/catalogo/{tarea_id}")
async def desactivar_tarea_catalogo(
    tarea_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(text(
        "UPDATE catalogo_tareas SET activo = FALSE WHERE id = :id"
    ), {"id": tarea_id})
    await db.flush()
    return {"mensaje": "Tarea desactivada del catálogo"}


# =============================================================================
# ENDPOINTS DE RUBROS
# =============================================================================

@router.get("/rubros")
async def listar_rubros(
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(text("""
        SELECT id, codigo, nombre, color_hex, icono, orden
        FROM rubros_tarea WHERE activo = TRUE ORDER BY orden, nombre
    """))
    return [{"id": str(r.id), "codigo": r.codigo, "nombre": r.nombre,
             "color_hex": r.color_hex, "icono": r.icono}
            for r in result.fetchall()]


# =============================================================================
# ENDPOINT: verificar dia habil
# =============================================================================

@router.get("/es-dia-habil")
async def es_dia_habil(
    fecha: date = Query(...),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    if fecha.weekday() >= 5:
        return {"fecha": fecha.isoformat(), "es_habil": False, "motivo": "fin_de_semana"}
    result = await db.execute(text(
        "SELECT nombre FROM feriados WHERE fecha = :fecha AND activo = TRUE"
    ), {"fecha": fecha})
    feriado = result.fetchone()
    if feriado:
        return {"fecha": fecha.isoformat(), "es_habil": False, "motivo": f"feriado: {feriado.nombre}"}
    return {"fecha": fecha.isoformat(), "es_habil": True, "motivo": None}

    """
Versión: v1.0.0
Agrega POST, PUT y DELETE para rubros_tarea.
Permisos: administrador, dueno, supervisor.
Preparado para multi-empresa: cuando se agregue empresa_id a rubros_tarea,
solo hay que agregar el filtro en cada query.
"""

class RubroCrear(BaseModel):
    """Esquema para crear o editar un rubro."""
    codigo:    str
    nombre:    str
    color_hex: Optional[str] = "#6366f1"
    icono:     Optional[str] = "📁"
    orden:     Optional[int] = 99


@router.post("/rubros", status_code=201)
async def crear_rubro(
    datos: RubroCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Crea un nuevo rubro para categorizar tareas del catálogo.
      Pueden crearlo: administrador, dueño y supervisor.
      El código debe ser único (case-insensitive).
      Preparado para multi-empresa: agregar empresa_id al INSERT
      cuando se implemente el Bloque B.
    DESCRIPCION TECNICA:
      INSERT con text() para evitar NoReferencedTableError del ORM.
      Verifica unicidad del código antes de insertar.
    """
    from sqlalchemy import text as sqlt
    import uuid as uuid_mod

    # Verificar permisos
    perfiles = await _obtener_perfiles_param(usuario_actual.id, db)
    if not any(p in perfiles for p in ["administrador", "dueno", "supervisor"]):
        raise HTTPException(403, "Solo supervisores y administradores pueden crear rubros")

    # Verificar unicidad del código
    dup = await db.execute(sqlt(
        "SELECT id FROM rubros_tarea WHERE UPPER(codigo) = UPPER(:codigo) AND activo = TRUE"
    ), {"codigo": datos.codigo})
    if dup.fetchone():
        raise HTTPException(400, f"Ya existe un rubro con el código '{datos.codigo}'")

    nuevo_id = str(uuid_mod.uuid4())
    await db.execute(sqlt("""
        INSERT INTO rubros_tarea
            (id, codigo, nombre, color_hex, icono, orden, activo, fecha_alta, creado_en)
        VALUES
            (:id, :codigo, :nombre, :color_hex, :icono, :orden, TRUE, CURRENT_DATE, NOW())
    """), {
        "id":        nuevo_id,
        "codigo":    datos.codigo.strip().upper(),
        "nombre":    datos.nombre.strip(),
        "color_hex": datos.color_hex or "#6366f1",
        "icono":     datos.icono or "📁",
        "orden":     datos.orden or 99,
    })
    return {"id": nuevo_id, "mensaje": "Rubro creado correctamente"}


@router.put("/rubros/{rubro_id}")
async def actualizar_rubro(
    rubro_id: str,
    datos: RubroCrear,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Actualiza los datos de un rubro existente.
      Verifica unicidad del código excluyendo el rubro actual.
    """
    from sqlalchemy import text as sqlt

    perfiles = await _obtener_perfiles_param(usuario_actual.id, db)
    if not any(p in perfiles for p in ["administrador", "dueno", "supervisor"]):
        raise HTTPException(403, "Solo supervisores y administradores pueden editar rubros")

    # Verificar unicidad excluyendo el actual
    dup = await db.execute(sqlt("""
        SELECT id FROM rubros_tarea
        WHERE UPPER(codigo) = UPPER(:codigo) AND activo = TRUE AND id != :id
    """), {"codigo": datos.codigo, "id": rubro_id})
    if dup.fetchone():
        raise HTTPException(400, f"Ya existe otro rubro con el código '{datos.codigo}'")

    await db.execute(sqlt("""
        UPDATE rubros_tarea SET
            codigo    = :codigo,
            nombre    = :nombre,
            color_hex = :color_hex,
            icono     = :icono,
            orden     = :orden
        WHERE id = :id AND activo = TRUE
    """), {
        "codigo":    datos.codigo.strip().upper(),
        "nombre":    datos.nombre.strip(),
        "color_hex": datos.color_hex or "#6366f1",
        "icono":     datos.icono or "📁",
        "orden":     datos.orden or 99,
        "id":        rubro_id,
    })
    return {"mensaje": "Rubro actualizado"}


@router.delete("/rubros/{rubro_id}")
async def desactivar_rubro(
    rubro_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Baja lógica de un rubro (activo = FALSE).
      Solo puede desactivarse si no tiene tareas activas asociadas.
      Administradores y dueños únicamente (no supervisores).
    """
    from sqlalchemy import text as sqlt
    from datetime import date

    perfiles = await _obtener_perfiles_param(usuario_actual.id, db)
    if not any(p in perfiles for p in ["administrador", "dueno"]):
        raise HTTPException(403, "Solo administradores pueden eliminar rubros")

    # Verificar que no tenga tareas activas en el catálogo
    tareas = await db.execute(sqlt("""
        SELECT COUNT(*) AS cnt FROM catalogo_tareas
        WHERE rubro_id = :id AND activo = TRUE
    """), {"id": rubro_id})
    cnt = tareas.fetchone().cnt
    if cnt > 0:
        raise HTTPException(400,
            f"No se puede eliminar: el rubro tiene {cnt} tarea(s) activa(s) en el catálogo. "
            "Reasigná las tareas a otro rubro primero.")

    await db.execute(sqlt("""
        UPDATE rubros_tarea SET activo = FALSE, fecha_baja = :hoy
        WHERE id = :id
    """), {"id": rubro_id, "hoy": date.today()})
    return {"mensaje": "Rubro desactivado"}


async def _obtener_perfiles_param(usuario_id, db):
    """Helper local para obtener perfiles del usuario en parametros.py"""
    from sqlalchemy import text as sqlt
    result = await db.execute(sqlt("""
        SELECT p.codigo FROM perfiles p
        JOIN usuario_perfiles up ON up.perfil_id = p.id
        WHERE up.usuario_id = :uid AND up.activo = TRUE
    """), {"uid": str(usuario_id)})
    return [r.codigo for r in result.fetchall()]

@router.post("/empresa/logo")
async def subir_logo_empresa(
    archivo: UploadFile = File(...),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Sube el logo de la empresa activa.
      Acepta JPG, PNG, SVG, WEBP. Tamaño máximo 2MB.
      Guarda el archivo en static/logos/ y actualiza logo_url en la BD.
    DESCRIPCION TECNICA:
      El archivo se guarda con el nombre empresa_{id}.{ext}
      La URL se construye como /static/logos/empresa_{id}.{ext}
      Sobrescribe el logo anterior si existe.
    """
    from sqlalchemy import text as sqlt
    import os, uuid as uuid_mod

    # Verificar permisos
    perfiles = await _obtener_perfiles_param(usuario_actual.id, db)
    if not any(p in perfiles for p in ["administrador", "dueno"]):
        raise HTTPException(403, "Solo administradores pueden cambiar el logo")

    # Verificar tipo de archivo
    ext = archivo.filename.rsplit(".", 1)[-1].lower() if "." in archivo.filename else ""
    if ext not in ("jpg", "jpeg", "png", "svg", "webp"):
        raise HTTPException(400, "Formato no permitido. Usar JPG, PNG, SVG o WEBP")

    # Verificar tamaño (máximo 2MB)
    contenido = await archivo.read()
    if len(contenido) > 2 * 1024 * 1024:
        raise HTTPException(400, "El archivo es demasiado grande. Máximo 2MB")

    # Obtener empresa activa
    emp = await db.execute(sqlt(
        "SELECT id FROM empresas WHERE activa = TRUE LIMIT 1"
    ))
    empresa = emp.fetchone()
    if not empresa:
        raise HTTPException(404, "No hay empresa activa")

    # Guardar archivo
    nombre_archivo = f"empresa_{empresa.id}.{ext}"
    ruta_archivo   = os.path.join("static", "logos", nombre_archivo)
    with open(ruta_archivo, "wb") as f:
        f.write(contenido)

    # Actualizar logo_url en la BD
    logo_url = f"/static/logos/{nombre_archivo}"
    await db.execute(sqlt("""
        UPDATE empresas SET logo_url = :url WHERE id = :id
    """), {"url": logo_url, "id": str(empresa.id)})

    await db.commit()
    await db.commit()
    return {"logo_url": logo_url, "mensaje": "Logo actualizado correctamente"}
