"""
API de Notificaciones
Gestiona las notificaciones del sistema para cada usuario.
Incluye: tareas por vencer, alertas de seguimiento, mensajes del supervisor.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, date, timedelta
import pytz

from app.core.database import get_db
from app.core.config import settings
from app.api.auth import obtener_usuario_actual
from app.models.usuario import Usuario

router = APIRouter()
TZ = pytz.timezone(settings.TIMEZONE)


@router.get("/")
async def listar_notificaciones(
    solo_no_leidas: bool = Query(default=False),
    limite: int = Query(default=20, le=100),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Lista las notificaciones del usuario actual"""
    filtro = "AND n.leida = FALSE" if solo_no_leidas else ""

    result = await db.execute(text(f"""
        SELECT id, tipo, titulo, mensaje, leida, datos_extra, creado_en
        FROM notificaciones
        WHERE usuario_id = :uid {filtro}
        ORDER BY creado_en DESC
        LIMIT :limite
    """), {"uid": str(usuario_actual.id), "limite": limite})

    notifs = result.fetchall()
    return [
        {
            "id": str(n.id),
            "tipo": n.tipo,
            "titulo": n.titulo,
            "mensaje": n.mensaje,
            "leida": n.leida,
            "datos_extra": n.datos_extra,
            "creado_en": n.creado_en.isoformat() if n.creado_en else None,
        }
        for n in notifs
    ]


@router.get("/conteo-no-leidas")
async def contar_no_leidas(
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Cuenta rápida de notificaciones sin leer (para el badge del ícono)"""
    result = await db.execute(text("""
        SELECT COUNT(*) FROM notificaciones
        WHERE usuario_id = :uid AND leida = FALSE
    """), {"uid": str(usuario_actual.id)})
    return {"cantidad": result.scalar() or 0}


@router.post("/{notificacion_id}/marcar-leida")
async def marcar_leida(
    notificacion_id: str,
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Marca una notificación como leída"""
    await db.execute(text("""
        UPDATE notificaciones
        SET leida = TRUE, leida_en = NOW()
        WHERE id = :id AND usuario_id = :uid
    """), {"id": notificacion_id, "uid": str(usuario_actual.id)})
    await db.flush()
    return {"mensaje": "Notificación marcada como leída"}


@router.post("/marcar-todas-leidas")
async def marcar_todas_leidas(
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Marca todas las notificaciones del usuario como leídas"""
    result = await db.execute(text("""
        UPDATE notificaciones
        SET leida = TRUE, leida_en = NOW()
        WHERE usuario_id = :uid AND leida = FALSE
        RETURNING id
    """), {"uid": str(usuario_actual.id)})
    cantidad = len(result.fetchall())
    await db.flush()
    return {"mensaje": f"{cantidad} notificaciones marcadas como leídas"}


@router.post("/generar-alertas-diarias")
async def generar_alertas_diarias(
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """
    Genera notificaciones para el día:
    - Tareas heredadas (venían de ayer sin completar)
    - Tareas que vencen hoy
    - Etapas de seguimiento que vencen hoy
    Solo administradores/supervisores pueden ejecutar esto manualmente.
    Normalmente se ejecuta por el job nocturno automático.
    """
    ahora = datetime.now(TZ)
    hoy = date.today()
    notifs_creadas = 0

    # 1. Tareas heredadas para cada operador
    result = await db.execute(text("""
        SELECT asignado_a_id, COUNT(*) AS cantidad
        FROM tareas
        WHERE fecha_planificada = :hoy
          AND es_heredada = TRUE
          AND estado = 'pendiente'
          AND activa = TRUE
        GROUP BY asignado_a_id
    """), {"hoy": hoy})

    for row in result.fetchall():
        await db.execute(text("""
            INSERT INTO notificaciones
                (usuario_id, tipo, titulo, mensaje, leida, creado_en)
            VALUES
                (:uid, 'sistema',
                 :titulo, :msg, FALSE, :ahora)
        """), {
            "uid": str(row.asignado_a_id),
            "titulo": f"🔁 {row.cantidad} tarea(s) pendiente(s) de ayer",
            "msg": f"Tenés {row.cantidad} tarea(s) que no completaste ayer y pasaron a hoy.",
            "ahora": ahora,
        })
        notifs_creadas += 1

    # 2. Tareas que vencen hoy
    result2 = await db.execute(text("""
        SELECT t.asignado_a_id, t.id AS tarea_id,
               COALESCE(ct.nombre, t.nombre_personalizado) AS nombre_tarea,
               c.razon_social AS cliente
        FROM tareas t
        LEFT JOIN catalogo_tareas ct ON t.catalogo_tarea_id = ct.id
        LEFT JOIN clientes c ON t.cliente_id = c.id
        WHERE t.fecha_vencimiento = :hoy
          AND t.estado NOT IN ('completada','cancelada','vencida')
          AND t.activa = TRUE
    """), {"hoy": hoy})

    for row in result2.fetchall():
        await db.execute(text("""
            INSERT INTO notificaciones
                (usuario_id, tipo, titulo, mensaje, leida, creado_en)
            VALUES
                (:uid, 'tarea_por_vencer', :titulo, :msg, FALSE, :ahora)
        """), {
            "uid": str(row.asignado_a_id),
            "titulo": "⚠️ Tarea vence HOY",
            "msg": f"La tarea '{row.nombre_tarea}'{' para ' + row.cliente if row.cliente else ''} vence hoy.",
            "ahora": ahora,
        })
        notifs_creadas += 1

    await db.flush()
    return {"mensaje": f"Se generaron {notifs_creadas} notificaciones"}

