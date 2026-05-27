"""
=============================================================
Archivo: database.py
-------------------------------------------------------------
DESCRIPCIÓN FUNCIONAL:
  Configura la conexión asíncrona a PostgreSQL (Supabase) y
  provee la dependencia get_db() para inyección en los endpoints
  de FastAPI. Maneja commit/rollback automático por request.

DESCRIPCIÓN TÉCNICA:
  Usa SQLAlchemy async con psycopg3 (psycopg, NO asyncpg).
  El parámetro prepared_statement_cache_size=0 en connect_args
  resuelve el error "DuplicatePreparedStatement: prepared statement
  _pg3_0 already exists" que ocurre cuando psycopg3 reutiliza
  conexiones del pool y encuentra prepared statements duplicados.
  pool_pre_ping=True verifica la conexión antes de usarla.
  pool_size y max_overflow controlan el tamaño del pool de conexiones.
=============================================================
"""

# ── Importaciones de SQLAlchemy async ───────────────────────────────────────
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession  # Motor y sesión async
from sqlalchemy.orm import declarative_base, sessionmaker              # Base ORM y factory de sesiones

# ── Importación de configuración del proyecto ────────────────────────────────
from app.core.config import settings  # Variables de entorno (.env)

# ── Normalización de la URL de conexión ─────────────────────────────────────
# Garantiza que siempre use el driver postgresql+psycopg:// independientemente
# de cómo venga definida la variable DATABASE_URL en el .env
DATABASE_URL = settings.DATABASE_URL.replace(
    "postgresql://",          "postgresql+psycopg://"   # Convierte URL estándar
).replace(
    "postgresql+asyncpg://",  "postgresql+psycopg://"   # Convierte si venía con asyncpg
)

# ── Creación del motor async ─────────────────────────────────────────────────
engine = create_async_engine(
    DATABASE_URL,
    echo=False,           # No loguear SQL en producción (cambiar a True para debug)
    pool_pre_ping=True,   # Verifica la conexión antes de usarla (detecta conexiones muertas)
    pool_size=5,          # Número de conexiones permanentes en el pool
    max_overflow=10,      # Conexiones extra permitidas sobre pool_size en picos de carga
    connect_args={
        # FIX: psycopg3 async + SQLAlchemy reutiliza conexiones del pool y choca
        # con prepared statements que ya existen en la sesión de PostgreSQL.
        # Deshabilitar el caché de prepared statements elimina el error:
        # "DuplicatePreparedStatement: prepared statement _pg3_0 already exists"
        "prepare_threshold": None,  # Deshabilita prepared statements automáticos en psycopg3
    },
)

# ── Factory de sesiones async ────────────────────────────────────────────────
# Produce instancias de AsyncSession configuradas para no expirar objetos al hacer commit
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,       # Usa la clase de sesión asíncrona
    expire_on_commit=False,    # Los objetos siguen accesibles después del commit
)

# ── Base declarativa para los modelos ORM ────────────────────────────────────
Base = declarative_base()  # Todos los modelos (Usuario, Tarea, etc.) heredan de esta base


async def get_db():
    """
    DESCRIPCIÓN FUNCIONAL:
      Dependencia de FastAPI que provee una sesión de BD por request.
      Hace commit automático si el handler termina sin error,
      o rollback si ocurre una excepción.

    DESCRIPCIÓN TÉCNICA:
      Generador async usado con Depends(get_db) en los endpoints.
      El bloque try/except/finally garantiza que la sesión siempre
      se cierre, incluso si ocurre un error no manejado.
    """
    async with AsyncSessionLocal() as session:  # Abre una sesión nueva del pool
        try:
            yield session               # Entrega la sesión al endpoint
            await session.commit()      # Commit automático si no hubo excepción
        except Exception:
            await session.rollback()    # Rollback si el handler lanzó cualquier error
            raise                       # Re-lanza la excepción para que FastAPI la maneje
        finally:
            await session.close()       # Siempre cierra y devuelve la conexión al pool