"""Modelo Cliente"""
from sqlalchemy import Column, String, Boolean, Date, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
import uuid

class Cliente(Base):
    __tablename__ = "clientes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    razon_social = Column(String(200), nullable=False)
    cuit = Column(String(20))
    email = Column(String(200))
    telefono = Column(String(50))
    celular = Column(String(50))
    direccion = Column(Text)
    localidad = Column(String(100))
    provincia = Column(String(100), default="Buenos Aires")
    responsable_interno_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"))
    notas = Column(Text)
    activo = Column(Boolean, default=True)
    fecha_alta = Column(Date)
    fecha_baja = Column(Date)
    creado_en = Column(DateTime(timezone=True))
    creado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"))
    actualizado_en = Column(DateTime(timezone=True))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id"))
