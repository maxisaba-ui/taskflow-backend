from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title="TaskFlow Pro",
    description="Sistema de gestión de tareas para estudios contables",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir archivos estáticos (logos de empresa, etc.)
app.mount("/static", StaticFiles(directory="static"), name="static")

from app.api import auth, tareas, clientes, usuarios, servicios, seguimiento, reportes, parametros, notificaciones
from app.api import auditoria as auditoria_router
from app.api import tareas_complejas
from app.scheduler import iniciar_scheduler

app.include_router(auditoria_router.router,   prefix="/api/v1/auditoria",        tags=["auditoria"])
app.include_router(tareas_complejas.router,   prefix="/api/v1/tareas-complejas", tags=["tareas-complejas"])
app.include_router(auth.router,               prefix="/api/v1/auth",             tags=["auth"])
app.include_router(tareas.router,             prefix="/api/v1/tareas",           tags=["tareas"])
app.include_router(clientes.router,           prefix="/api/v1/clientes",         tags=["clientes"])
app.include_router(usuarios.router,           prefix="/api/v1/usuarios",         tags=["usuarios"])
app.include_router(servicios.router,          prefix="/api/v1/servicios",        tags=["servicios"])
app.include_router(seguimiento.router,        prefix="/api/v1/seguimiento",      tags=["seguimiento"])
app.include_router(reportes.router,           prefix="/api/v1/reportes",         tags=["reportes"])
app.include_router(parametros.router,         prefix="/api/v1/parametros",       tags=["parametros"])
app.include_router(notificaciones.router,     prefix="/api/v1/notificaciones",   tags=["notificaciones"])

@app.on_event("startup")
async def startup():
    await iniciar_scheduler()

@app.get("/")
async def root():
    return {"mensaje": "TaskFlow Pro API v1.0", "status": "ok"}

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
