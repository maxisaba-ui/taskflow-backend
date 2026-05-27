"""
=============================================================
Archivo: auditoria.py
Versión: v1.0.1
-------------------------------------------------------------
DESCRIPCION FUNCIONAL:
  Servicio de auditoría que registra todos los cambios
  importantes del sistema en la tabla auditoria_log.

DESCRIPCION TECNICA:
  Fix v1.0.1: la columna ip_address en auditoria_log es de
  tipo INET en PostgreSQL, pero el ORM la define como String.
  SQLAlchemy enviaba VARCHAR y PostgreSQL rechazaba con
  DatatypeMismatch. Solución: INSERT con SQL directo usando
  CAST(:ip AS INET) para convertir correctamente.
  Si ip es None se inserta NULL sin el cast.

HISTORIAL:
  v1.0.0 - Registro de auditoría via ORM.
  v1.0.1 - Fix: ip_address casteada a INET en el INSERT.
=============================================================
"""

# ── Importaciones ────────────────────────────────────────────
from sqlalchemy.ext.asyncio import AsyncSession   # Sesión async de SQLAlchemy
from sqlalchemy import text                        # SQL directo con parámetros
from datetime import datetime                      # Para el timestamp de la acción
import pytz                                        # Para timezone Argentina
import uuid                                        # Para generar UUID del registro de log

# ── Timezone del sistema ─────────────────────────────────────
TZ_ARG = pytz.timezone("America/Argentina/Buenos_Aires")


async def registrar_auditoria(
    db: AsyncSession,
    tabla: str,
    registro_id: str,
    operacion: str,
    campo: str = None,
    valor_anterior: str = None,
    valor_nuevo: str = None,
    usuario_id: str = None,
    ip: str = None,
):
    """
    DESCRIPCION FUNCIONAL:
      Registra un evento de auditoría en auditoria_log.
      Se llama desde cualquier endpoint que modifique datos críticos.

    DESCRIPCION TECNICA:
      Usa INSERT con text() en lugar de ORM para poder castear
      ip_address a INET correctamente.
      Si ip es None inserta NULL directamente sin el cast
      (CAST(NULL AS INET) también funciona pero es innecesario).
      El UUID del log se genera en Python para independencia del ORM.
    """
    nuevo_id = str(uuid.uuid4())  # UUID único para este registro de log
    ahora    = datetime.now(TZ_ARG)  # Timestamp con timezone Argentina

    # Usar SQL directo para castear ip_address a INET
    # La columna en BD es de tipo inet — no acepta VARCHAR directamente
    await db.execute(text("""
        INSERT INTO auditoria_log (
            id, tabla_afectada, registro_id, operacion,
            campo_modificado, valor_anterior, valor_nuevo,
            usuario_id, ip_address, user_agent, timestamp_accion
        ) VALUES (
            :id ::UUID,
            :tabla,
            :registro_id ::UUID,
            :operacion,
            :campo,
            :valor_anterior,
            :valor_nuevo,
            :usuario_id ::UUID,
            CAST(:ip AS INET),
            :user_agent,
            :timestamp
        )
    """), {
        "id":            nuevo_id,
        "tabla":         tabla,
        "registro_id":   registro_id,
        "operacion":     operacion,
        "campo":         campo,
        "valor_anterior": valor_anterior,
        "valor_nuevo":   valor_nuevo,
        "usuario_id":    usuario_id,
        "ip":            ip,            # None → CAST(NULL AS INET) = NULL
        "user_agent":    None,
        "timestamp":     ahora,
    })