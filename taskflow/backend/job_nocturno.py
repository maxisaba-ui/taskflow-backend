"""
TaskFlow Pro — Job nocturno automático
Se ejecuta a las 23:59 todos los días para:
  1. Heredar tareas incompletas al siguiente día hábil
  2. Marcar como vencidas las tareas con fecha pasada
  3. Generar notificaciones de alerta para el día siguiente
  4. Limpiar sesiones expiradas

Cómo programarlo en Railway:
  - Ir al proyecto en Railway
  - Settings → Cron Jobs
  - Comando: python job_nocturno.py
  - Schedule: 59 23 * * * (todos los días a las 23:59)
"""
import asyncio
import asyncpg
import os
from datetime import datetime, date
import pytz

DATABASE_URL = os.environ.get("DATABASE_URL", "")
TZ = pytz.timezone("America/Argentina/Buenos_Aires")


async def ejecutar_mantenimiento():
    print(f"\n{'='*50}")
    print(f"TaskFlow Pro — Job nocturno")
    print(f"Fecha/hora: {datetime.now(TZ).strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"{'='*50}")

    # Conectar a la base de datos
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        hoy = date.today()
        total_cambios = 0

        # ── 1. Heredar tareas incompletas ──────────────────────
        print("\n[1/4] Heredando tareas incompletas...")
        resultado = await conn.fetchval(
            "SELECT heredar_tareas_del_dia($1::DATE)", hoy
        )
        print(f"      → {resultado} tareas heredadas al día siguiente")
        total_cambios += resultado or 0

        # ── 2. Marcar tareas vencidas ──────────────────────────
        print("\n[2/4] Marcando tareas vencidas...")
        vencidas = await conn.execute("""
            UPDATE tareas
            SET estado = 'vencida', actualizado_en = NOW()
            WHERE estado IN ('pendiente', 'pausada')
              AND fecha_vencimiento < $1
              AND activa = TRUE
        """, hoy)
        n_vencidas = int(vencidas.split()[-1])
        print(f"      → {n_vencidas} tareas marcadas como vencidas")
        total_cambios += n_vencidas

        # ── 3. Generar notificaciones ──────────────────────────
        print("\n[3/4] Generando notificaciones...")
        ahora = datetime.now(TZ)

        # Notificar tareas heredadas a sus operadores
        tareas_heredadas = await conn.fetch("""
            SELECT asignado_a_id, COUNT(*) AS cantidad
            FROM tareas
            WHERE fecha_planificada = $1 + 1
              AND es_heredada = TRUE
              AND estado = 'pendiente'
              AND activa = TRUE
            GROUP BY asignado_a_id
        """, hoy)

        for row in tareas_heredadas:
            await conn.execute("""
                INSERT INTO notificaciones
                    (usuario_id, tipo, titulo, mensaje, leida, creado_en)
                VALUES ($1, 'sistema', $2, $3, FALSE, $4)
            """,
                row["asignado_a_id"],
                f"🔁 {row['cantidad']} tarea(s) pendiente(s) para mañana",
                f"Tenés {row['cantidad']} tarea(s) que no completaste hoy y "
                f"pasarán automáticamente a mañana.",
                ahora,
            )

        # Notificar etapas de seguimiento que vencen mañana
        manana = date.fromordinal(hoy.toordinal() + 1)
        etapas_manana = await conn.fetch("""
            SELECT
                sc.responsable_id,
                sc.nombre AS seguimiento,
                c.razon_social AS cliente,
                se.nombre AS etapa
            FROM seguimiento_etapas se
            JOIN seguimiento_complejo sc ON se.seguimiento_id = sc.id
            JOIN clientes c ON sc.cliente_id = c.id
            WHERE se.fecha_limite_calculada::DATE = $1
              AND se.estado NOT IN ('completada_ok','completada_tarde')
              AND sc.activo = TRUE
        """, manana)

        for row in etapas_manana:
            await conn.execute("""
                INSERT INTO notificaciones
                    (usuario_id, tipo, titulo, mensaje, leida, creado_en)
                VALUES ($1, 'tarea_por_vencer', $2, $3, FALSE, $4)
            """,
                row["responsable_id"],
                f"⚠️ Etapa vence MAÑANA",
                f"La etapa '{row['etapa']}' del seguimiento '{row['seguimiento']}' "
                f"para {row['cliente']} vence mañana.",
                ahora,
            )

        print(f"      → {len(tareas_heredadas)} notifs de herencia")
        print(f"      → {len(etapas_manana)} notifs de vencimientos")

        # ── 4. Limpiar sesiones expiradas ──────────────────────
        print("\n[4/4] Limpiando sesiones expiradas...")
        limpiadas = await conn.execute("""
            UPDATE sesiones SET activa = FALSE
            WHERE expira_en < NOW() - INTERVAL '30 days' AND activa = TRUE
        """)
        n_limpiadas = int(limpiadas.split()[-1])
        print(f"      → {n_limpiadas} sesiones desactivadas")

        print(f"\n{'='*50}")
        print(f"✅ Job completado — {total_cambios} cambios totales")
        print(f"{'='*50}\n")

    except Exception as e:
        print(f"\n❌ Error en job nocturno: {e}")
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    if not DATABASE_URL:
        print("❌ ERROR: La variable DATABASE_URL no está configurada.")
        exit(1)
    asyncio.run(ejecutar_mantenimiento())
