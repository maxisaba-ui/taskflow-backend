"""
Modelos de base de datos para usuarios, perfiles y sesiones
"""
from sqlalchemy import Column, String, Boolean, Date, DateTime, ForeignKey, Time, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid


class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_id = Column(String(100), unique=True)
    email = Column(String(200), nullable=False, unique=True)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    foto_url = Column(String(500))
    horario_inicio = Column(Time)
    horario_fin = Column(Time)
    activo = Column(Boolean, default=True)
    fecha_alta = Column(Date)
    fecha_baja = Column(Date)
    ultimo_login = Column(DateTime(timezone=True))
    creado_en = Column(DateTime(timezone=True))
    actualizado_en = Column(DateTime(timezone=True))
    creado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"))
    
    # foreign_keys explícito para evitar ambigüedad (hay múltiples FK a usuarios)
    perfiles = relationship(
        "UsuarioPerfil",
        back_populates="usuario",
        lazy="select",
        foreign_keys="[UsuarioPerfil.usuario_id]"
    )
    sesiones = relationship(
        "Sesion",
        back_populates="usuario",
        lazy="select",
        foreign_keys="[Sesion.usuario_id]"
    )


class Perfil(Base):
    __tablename__ = "perfiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo = Column(String(50), nullable=False, unique=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(String(500))
    activo = Column(Boolean, default=True)
    
    usuarios = relationship("UsuarioPerfil", back_populates="perfil")


class UsuarioPerfil(Base):
    __tablename__ = "usuario_perfiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    perfil_id = Column(UUID(as_uuid=True), ForeignKey("perfiles.id"), nullable=False)
    activo = Column(Boolean, default=True)
    fecha_alta = Column(Date)
    fecha_baja = Column(Date)
    asignado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"))
    creado_en = Column(DateTime(timezone=True))
    
    usuario = relationship("Usuario", back_populates="perfiles", foreign_keys=[usuario_id])
    perfil = relationship("Perfil", back_populates="usuarios")
    
    __table_args__ = (
        UniqueConstraint("usuario_id", "perfil_id", name="uq_usuario_perfil"),
    )


class SupervisorOperador(Base):
    __tablename__ = "supervisor_operador"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supervisor_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    operador_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    activo = Column(Boolean, default=True)
    fecha_inicio = Column(Date)
    fecha_fin = Column(Date)
    creado_en = Column(DateTime(timezone=True))
    
    __table_args__ = (
        UniqueConstraint("supervisor_id", "operador_id", name="uq_supervisor_operador"),
        CheckConstraint("supervisor_id != operador_id", name="chk_no_autorelacion"),
    )


class Sesion(Base):
    __tablename__ = "sesiones"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    token_hash = Column(String(500), nullable=False)
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    activa = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True))
    expira_en = Column(DateTime(timezone=True), nullable=False)
    cerrado_en = Column(DateTime(timezone=True))
    
    usuario = relationship("Usuario", back_populates="sesiones")
