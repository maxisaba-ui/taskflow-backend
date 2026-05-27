# TaskFlow Pro
## Sistema de gestión de tareas para estudios contables

[![Tests](https://img.shields.io/badge/tests-68%20passed-brightgreen)]()
[![Python](https://img.shields.io/badge/Python-3.12-blue)]()
[![React](https://img.shields.io/badge/React-18-blue)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)]()
[![Hosting](https://img.shields.io/badge/hosting-100%25%20gratuito-green)]()

---

## 🗂 ÍNDICE DE ARCHIVOS

### 📋 Documentos — empezá por acá

| Archivo | Descripción |
|---|---|
| `docs/01_ANALISIS_FUNCIONAL.md` | Qué hace el sistema, módulos, reglas de negocio |
| `docs/02_GUIA_INSTALACION.md` | **Pasos 1 a 7 para poner en marcha** (sin saber programar) |
| `docs/03_MANUAL_USUARIO.md` | Manual para operadores, supervisores y administradores |
| `docs/04_DER_ARQUITECTURA_DATOS.md` | Diagrama de la base de datos |
| `docs/05_QUE_ESTA_HECHO_Y_QUE_FALTA.md` | División de trabajo: qué hice yo, qué hacés vos |

### 🗄 Scripts SQL — ejecutar en Supabase en orden

| Archivo | Cuándo ejecutar |
|---|---|
| `scripts/01_crear_base_de_datos.sql` | **Primera vez** — crea todas las tablas |
| `scripts/02_datos_de_prueba.sql` | Opcional — carga datos de ejemplo para testear |
| `scripts/03_crear_admin.sql` | **Obligatorio** — crea tu primer usuario admin |
| `scripts/04_mantenimiento_nocturno.sql` | Referencia — lo ejecuta el job automático |

### ⚙️ Backend (Python / FastAPI) — subir a Railway

```
backend/
├── main.py                  ← Punto de entrada del servidor
├── requirements.txt         ← Dependencias (pip install -r requirements.txt)
├── Procfile                 ← Para Railway (no tocar)
├── .env.example             ← Copiar como .env y completar
├── job_nocturno.py          ← Tarea automática nocturna
├── app/
│   ├── api/
│   │   ├── auth.py          ← Login con Google + JWT
│   │   ├── tareas.py        ← PLAY / PAUSA / FIN + herencia
│   │   ├── clientes.py      ← ABM de clientes
│   │   ├── usuarios.py      ← ABM de usuarios
│   │   ├── servicios.py     ← Servicios y procedimientos
│   │   ├── seguimiento.py   ← Seguimiento complejo con etapas
│   │   ├── reportes.py      ← Métricas diarias, mensuales, por cliente
│   │   ├── parametros.py    ← Empresa, feriados, catálogo
│   │   └── notificaciones.py← Alertas y avisos
│   ├── models/              ← Estructura de tablas (SQLAlchemy)
│   ├── core/                ← Config y conexión a BD
│   └── services/            ← Auditoría
└── tests/
    ├── test_sistema.py      ← Tests unitarios (68 tests — todos pasan ✅)
    └── test_integracion.py  ← Tests de flujo completo
```

### 🌐 Frontend (React / Vite / TailwindCSS) — subir a Vercel

```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── .env.example             ← Copiar como .env.local y completar
└── src/
    ├── main.jsx             ← Punto de entrada
    ├── App.jsx              ← Rutas y protección por perfil
    ├── index.css            ← Estilos globales
    ├── api/client.js        ← Cliente HTTP hacia el backend
    ├── hooks/useAuth.js     ← Hook de autenticación
    ├── context/AuthContext.jsx
    ├── pages/
    │   ├── Login.jsx        ← Pantalla de login con Google
    │   ├── Dashboard.jsx    ← Panel principal con tareas del día
    │   ├── Clientes.jsx     ← Gestión de clientes
    │   ├── Seguimiento.jsx  ← Semáforos de tareas complejas
    │   ├── Supervisores.jsx ← Panel del supervisor
    │   ├── Reportes.jsx     ← Gráficos y métricas
    │   └── Administracion.jsx← Config del sistema
    └── components/
        ├── Layout.jsx       ← Sidebar + navegación
        ├── TareaCard.jsx    ← Card con PLAY/PAUSA/FIN
        ├── ResumenDia.jsx   ← Panel lateral de métricas
        └── admin/           ← Componentes de administración
```

### 🖥 Widget Windows — instalar en cada PC

```
widget/
├── widget.py               ← Programa principal (PyQt6)
├── requirements_widget.txt ← pip install -r requirements_widget.txt
└── compilar_widget.bat     ← Doble clic → genera TaskFlow_Widget.exe
```

---

## 🚀 INICIO RÁPIDO (resumen de 5 pasos)

**1.** Crear cuentas gratuitas en: Supabase + GitHub + Railway + Vercel + Google Cloud

**2.** En Supabase SQL Editor → pegar y ejecutar `scripts/01_crear_base_de_datos.sql`

**3.** En Supabase SQL Editor → ejecutar `scripts/03_crear_admin.sql` con tu email

**4.** Subir `backend/` a Railway y `frontend/` a Vercel (ver `docs/02_GUIA_INSTALACION.md`)

**5.** Configurar variables de entorno en Railway y Vercel (ver la guía)

**Tiempo estimado: 2.5 horas**

---

## 🏗 Stack tecnológico (100% gratuito)

| Capa | Tecnología | Hosting gratuito |
|---|---|---|
| Base de datos | PostgreSQL 15 | Supabase (500MB gratis) |
| Backend API | Python 3.12 + FastAPI | Railway (500h/mes gratis) |
| Frontend web | React 18 + Vite + TailwindCSS | Vercel (ilimitado gratis) |
| Widget Windows | Python + PyQt6 | Ejecutable .exe local |
| Autenticación | Google OAuth 2.0 | Google Cloud (gratis) |

---

## 👥 Perfiles de usuario

| Perfil | Puede hacer |
|---|---|
| **Operador** | Ver sus tareas, play/pausa/fin, agregar tareas propias |
| **Supervisor** | Todo lo anterior + asignar tareas, ver sus operadores, reportes de equipo |
| **Dueño** | Todo lo anterior + reportes globales de toda la empresa |
| **Administrador** | Todo + configuración completa del sistema |

Un usuario puede tener más de un perfil al mismo tiempo.

---

## ✅ Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
# Resultado: 68 passed ✅
```

---

*TaskFlow Pro v1.0 — Sistema de gestión de tareas para estudios contables*
*Generado con Claude — Anthropic*
