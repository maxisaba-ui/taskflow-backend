"""
=============================================================
Archivo: tarea.py  (app/models/tarea.py)
Versión: v1.0.1
-------------------------------------------------------------
DESCRIPCION FUNCIONAL:
  Modelos ORM de Tareas, Pausas y Comentarios.

DESCRIPCION TECNICA:
  Fix v1.0.1: la FK a seguimiento_complejo se define con
  use_alter=True para que SQLAlchemy no intente resolver
  la tabla referenciada al construir el metadata.
  La tabla seguimiento_complejo existe en la BD de Supabase
  pero no tiene modelo ORM en app/models/, por lo que
  SQLAlchemy lanzaba NoReferencedTableError al hacer flush.

HISTORIAL:
  v1.0.0 - Modelo inicial.
  v1.0.1 - Fix: seguimiento_complejo_id usa use_alter=True
           para evitar NoReferencedTableError al hacer flush.
=============================================================
"""
from sqlalchemy import Column, String, Boolean, Date, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid

class Tarea(Base):
    __tablename__ = "tareas"

    id                        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    catalogo_tarea_id         = Column(UUID(as_uuid=True), ForeignKey("catalogo_tareas.id"))
    nombre_personalizado      = Column(String(200))
    descripcion               = Column(Text)
    rubro_id                  = Column(UUID(as_uuid=True), ForeignKey("rubros_tarea.id"))
    asignado_a_id             = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    cliente_id                = Column(UUID(as_uuid=True), ForeignKey("clientes.id"))
    servicio_id               = Column(UUID(as_uuid=True), ForeignKey("servicios.id"))
    fecha_planificada         = Column(Date, nullable=False)
    fecha_vencimiento         = Column(Date)
    prioridad                 = Column(String(20),  default="media",    server_default="media")
    estado                    = Column(String(30),  default="pendiente", server_default="pendiente")
    inicio_real               = Column(DateTime(timezone=True))
    fin_real                  = Column(DateTime(timezone=True))
    tiempo_trabajado_minutos  = Column(Integer, default=0, server_default="0")
    heredada_de_id            = Column(UUID(as_uuid=True), ForeignKey("tareas.id"))
    es_heredada               = Column(Boolean, default=False, server_default="false")
    creada_por_id             = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    tipo_creacion             = Column(String(30),  default="supervisor", server_default="supervisor")
    comentario_supervisor     = Column(Text)
    comentario_operador       = Column(Text)
    es_tarea_compleja         = Column(Boolean, default=False, server_default="false")

    # FIX v1.0.1: use_alter=True evita que SQLAlchemy intente resolver
    # la tabla 'seguimiento_complejo' al construir el metadata.
    # La tabla existe en Supabase pero no tiene modelo ORM en app/models/.
    # Sin use_alter=True, el flush lanzaba NoReferencedTableError.
    seguimiento_complejo_id   = Column(
        UUID(as_uuid=True),
        ForeignKey("seguimiento_complejo.id", use_alter=True, name="fk_tarea_seguimiento"),
    )

    activa                    = Column(Boolean, default=True, server_default="true")
    creado_en                 = Column(DateTime(timezone=True))
    actualizado_en            = Column(DateTime(timezone=True))
    actualizado_por           = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"))

    pausas      = relationship("TareaPausa",     back_populates="tarea", lazy="select")
    comentarios = relationship("TareaComentario", back_populates="tarea", lazy="select")


class TareaPausa(Base):
    __tablename__ = "tarea_pausas"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tarea_id         = Column(UUID(as_uuid=True), ForeignKey("tareas.id"), nullable=False)
    inicio_pausa     = Column(DateTime(timezone=True), nullable=False)
    fin_pausa        = Column(DateTime(timezone=True))
    motivo           = Column(Text, nullable=False)
    duracion_minutos = Column(Integer)
    creado_en        = Column(DateTime(timezone=True))

    tarea = relationship("Tarea", back_populates="pausas")


class TareaComentario(Base):
    __tablename__ = "tarea_comentarios"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tarea_id   = Column(UUID(as_uuid=True), ForeignKey("tareas.id"),    nullable=False)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"),  nullable=False)
    tipo       = Column(String(30), default="general")
    comentario = Column(Text, nullable=False)
    creado_en  = Column(DateTime(timezone=True))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id"))

    tarea = relationship("Tarea", back_populates="comentarios")