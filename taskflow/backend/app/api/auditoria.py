"""
=============================================================
Archivo: auditoria_endpoints.py
Versión: v1.0.0
-------------------------------------------------------------
DESCRIPCION FUNCIONAL:
  Endpoints REST para consulta del log de auditoría.
  Solo accesible para administradores y dueños.
  GET /auditoria/ con filtros de fecha, tabla y operacion.

=============================================================
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.api.auth import obtener_usuario_actual
from app.models.usuario import Usuario

router = APIRouter()


@router.get("/")
async def listar_auditoria(
    desde:      date         = Query(default=None),
    hasta:      date         = Query(default=None),
    tabla:      Optional[str] = Query(default=None),
    operacion:  Optional[str] = Query(default=None),
    usuario_actual: Usuario  = Depends(obtener_usuario_actual),
    db: AsyncSession         = Depends(get_db)
):
    """
    DESCRIPCION FUNCIONAL:
      Lista el log de auditoría con filtros opcionales.
      Solo accesible para administradores y dueños.
    DESCRIPCION TECNICA:
      JOIN con usuarios para obtener nombre del responsable.
      Filtros dinámicos por tabla, operacion y rango de fechas.
      Ordenado por timestamp descendente (más reciente primero).
    """
    from app.api.tareas import _obtener_perfiles

    # Verificar permisos: solo admin y dueño
    perfiles = await _obtener_perfiles(usuario_actual.id, db)
    if "administrador" not in perfiles and "dueno" not in perfiles:
        from fastapi import HTTPException
        raise HTTPException(403, "Solo administradores y dueños pueden ver la auditoría")

    if desde is None:
        desde = date.today().replace(day=1)   # Primer día del mes actual
    if hasta is None:
        hasta = date.today()

    # Construir filtros dinámicos
    filtros = ["a.timestamp_accion::DATE BETWEEN :desde AND :hasta"]
    params  = {"desde": desde, "hasta": hasta}

    if tabla:
        filtros.append("a.tabla_afectada = :tabla")
        params["tabla"] = tabla

    if operacion:
        filtros.append("a.operacion = :operacion")
        params["operacion"] = operacion

    where = " AND ".join(filtros)

    result = await db.execute(text(f"""
        SELECT
            a.id,
            a.tabla_afectada,
            a.registro_id::TEXT,
            a.operacion,
            a.campo_modificado,
            a.valor_anterior,
            a.valor_nuevo,
            a.timestamp_accion,
            a.usuario_id::TEXT,
            u.nombre || ' ' || u.apellido AS usuario_nombre
        FROM auditoria_log a
        LEFT JOIN usuarios u ON a.usuario_id = u.id
        WHERE {where}
        ORDER BY a.timestamp_accion DESC
        LIMIT 500
    """), params)

    return [
        {
            "id":               str(r.id),
            "tabla_afectada":   r.tabla_afectada,
            "registro_id":      r.registro_id,
            "operacion":        r.operacion,
            "campo_modificado": r.campo_modificado,
            "valor_anterior":   r.valor_anterior,
            "valor_nuevo":      r.valor_nuevo,
            "timestamp_accion": r.timestamp_accion.isoformat() if r.timestamp_accion else None,
            "usuario_id":       r.usuario_id,
            "usuario_nombre":   r.usuario_nombre or "—",
        }
        for r in result.fetchall()
    ]