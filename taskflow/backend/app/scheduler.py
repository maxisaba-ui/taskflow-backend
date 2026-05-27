"""
=============================================================
Archivo: scheduler.py
Versión: v1.0.0
-------------------------------------------------------------
DESCRIPCION FUNCIONAL:
  Scheduler de tareas automáticas del sistema.
  v1.0.0: herencia automática de tareas no finalizadas al
  día hábil siguiente. Se ejecuta a las 23:30 de cada día hábil.
  También purga el log de auditoría cada 90 días.

DESCRIPCION TECNICA:
  Usa asyncio.create_task para no bloquear el servidor.
  Se registra en el evento startup de FastAPI.
  Calcula el próximo día hábil consultando la tabla feriados.

REGISTRO EN main.py:
  from app.scheduler import iniciar_scheduler
  @app.on_event("startup")
  async def startup():
      await iniciar_scheduler()
=============================================================
"""

import asyncio
import logging
from datetime import datetime, date, timedelta, timezone

logger = logging.getLogger("taskflow.scheduler")

try:
    import pytz
    TZ = pytz.timezone("America/Argentina/Buenos_Aires")
except Exception:
    TZ = timezone.utc


async def _get_db_session():
    """Obtiene una sesión de BD para uso en el scheduler."""
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        return session


async def _siguiente_dia_habil(fecha: date, db) -> date:
    """
    Calcula el siguiente día hábil considerando feriados.
    1 día hábil = siguiente día que no sea sábado, domingo ni feriado.
    """
    from sqlalchemy import text as sqlt
    result = await db.execute(sqlt("""
        SELECT fecha FROM feriados
        WHERE anio IN (:anio, :anio_sig) AND activo = TRUE
    """), {"anio": fecha.year, "anio_sig": fecha.year + 1})
    feriados = {r.fecha for r in result.fetchall()}

    siguiente = fecha + timedelta(days=1)
    while siguiente.weekday() >= 5 or siguiente in feriados:
        siguiente += timedelta(days=1)
    return siguiente


async def _ejecutar_herencia_diaria():
    """
    Hereda tareas no finalizadas de todos los usuarios al día hábil siguiente.
    Se llama automáticamente a las 23:30 de cada día hábil.
    """
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import text as sqlt
    import uuid as uuid_mod

    logger.info("Scheduler: iniciando herencia diaria de tareas")
    hoy = date.today()

    # No ejecutar en fin de semana
    if hoy.weekday() >= 5:
        logger.info("Scheduler: fin de semana, herencia omitida")
        return

    async with AsyncSessionLocal() as db:
        try:
            # Verificar que hoy no sea feriado
            feriado = await db.execute(sqlt(
                "SELECT id FROM feriados WHERE fecha = :hoy AND activo = TRUE"
            ), {"hoy": hoy})
            if feriado.fetchone():
                logger.info("Scheduler: hoy es feriado, herencia omitida")
                return

            # Calcular día destino
            dia_siguiente = await _siguiente_dia_habil(hoy, db)

            # Cargar tareas no finalizadas del día
            result = await db.execute(sqlt("""
                SELECT
                    t.id, t.catalogo_tarea_id, t.nombre_personalizado,
                    t.descripcion, t.rubro_id, t.asignado_a_id,
                    t.cliente_id, t.servicio_id, t.fecha_vencimiento,
                    t.prioridad, t.tipo_creacion, t.comentario_supervisor,
                    t.creada_por_id
                FROM tareas t
                WHERE t.activa = TRUE
                  AND t.fecha_planificada = :hoy
                  AND t.estado IN ('pendiente', 'pausada', 'en_curso')
            """), {"hoy": hoy})
            tareas = result.fetchall()

            heredadas = 0
            for t in tareas:
                # Verificar que no exista ya una herencia de esta tarea
                dup = await db.execute(sqlt("""
                    SELECT id FROM tareas
                    WHERE heredada_de_id = :orig AND fecha_planificada = :dest AND activa = TRUE
                """), {"orig": str(t.id), "dest": dia_siguiente})
                if dup.fetchone():
                    continue

                nuevo_id = str(uuid_mod.uuid4())
                await db.execute(sqlt("""
                    INSERT INTO tareas (
                        id, catalogo_tarea_id, nombre_personalizado, descripcion,
                        rubro_id, asignado_a_id, cliente_id, servicio_id,
                        fecha_planificada, fecha_vencimiento, prioridad, estado,
                        creada_por_id, tipo_creacion, comentario_supervisor,
                        heredada_de_id, es_heredada, activa, creado_en
                    ) VALUES (
                        :id, :ctid, :nombre, :descripcion,
                        :rubro, :asignado, :cliente, :servicio,
                        :destino, :vencimiento, :prioridad, 'pendiente',
                        :creador, :tipo, :comentario,
                        :origen, TRUE, TRUE, NOW()
                    )
                """), {
                    "id":          nuevo_id,
                    "ctid":        str(t.catalogo_tarea_id) if t.catalogo_tarea_id else None,
                    "nombre":      t.nombre_personalizado,
                    "descripcion": t.descripcion,
                    "rubro":       str(t.rubro_id)       if t.rubro_id       else None,
                    "asignado":    str(t.asignado_a_id),
                    "cliente":     str(t.cliente_id)     if t.cliente_id     else None,
                    "servicio":    str(t.servicio_id)    if t.servicio_id    else None,
                    "destino":     dia_siguiente,
                    "vencimiento": t.fecha_vencimiento,
                    "prioridad":   t.prioridad,
                    "creador":     str(t.creada_por_id),
                    "tipo":        t.tipo_creacion,
                    "comentario":  t.comentario_supervisor,
                    "origen":      str(t.id),
                })
                heredadas += 1

            await db.commit()
            logger.info(f"Scheduler: {heredadas} tarea(s) heredadas → {dia_siguiente}")

        except Exception as e:
            await db.rollback()
            logger.error(f"Scheduler herencia error: {e}")


async def _purgar_auditoria():
    """
    Elimina registros de auditoría con más de 90 días hábiles.
    90 días corridos.
    Se ejecuta una vez por semana (los lunes a las 02:00).
    """
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import text as sqlt

    logger.info("Scheduler: iniciando purga de auditoría")
    async with AsyncSessionLocal() as db:
        try:
            # 90 días corridos
            resultado = await db.execute(sqlt("""
                DELETE FROM auditoria_log
                WHERE timestamp_accion < NOW() - INTERVAL '90 days'
            """))
            await db.commit()
            logger.info(f"Scheduler: auditoría purgada")
        except Exception as e:
            await db.rollback()
            logger.error(f"Scheduler purga error: {e}")


async def _loop_herencia():
    """
    Loop infinito que ejecuta la herencia a las 23:30 de cada día hábil.
    Calcula cuántos segundos faltan para la próxima ejecución y duerme.
    """
    while True:
        try:
            ahora    = datetime.now(TZ)
            # Próxima ejecución: hoy a las 23:30 o mañana a las 23:30
            objetivo = ahora.replace(hour=23, minute=30, second=0, microsecond=0)
            if ahora >= objetivo:
                objetivo += timedelta(days=1)

            espera = (objetivo - ahora).total_seconds()
            logger.info(f"Scheduler herencia: próxima ejecución en {espera/3600:.1f}h")
            await asyncio.sleep(espera)
            await _ejecutar_herencia_diaria()

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
            await asyncio.sleep(3600)  # Reintentar en 1 hora si hay error


async def _loop_purga():
    """
    Loop que ejecuta la purga de auditoría los lunes a las 02:00.
    """
    while True:
        try:
            ahora = datetime.now(TZ)
            # Calcular próximo lunes a las 02:00
            dias_hasta_lunes = (7 - ahora.weekday()) % 7 or 7
            proximo_lunes    = ahora + timedelta(days=dias_hasta_lunes)
            objetivo         = proximo_lunes.replace(hour=2, minute=0, second=0, microsecond=0)

            espera = (objetivo - ahora).total_seconds()
            logger.info(f"Scheduler purga: próxima ejecución en {espera/3600:.1f}h")
            await asyncio.sleep(espera)
            await _purgar_auditoria()

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Scheduler purga loop error: {e}")
            await asyncio.sleep(86400)  # Reintentar en 24h


async def iniciar_scheduler():
    """
    Inicia los loops del scheduler como tareas de asyncio en background.
    Llamar desde el evento startup de FastAPI en main.py.
    """
    asyncio.create_task(_loop_herencia())
    asyncio.create_task(_loop_purga())
    logger.info("Scheduler iniciado: herencia diaria 23:30, purga auditoria lunes 02:00")
