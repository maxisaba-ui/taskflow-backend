#!/bin/bash

# ============================================================
# TaskFlow Pro — SCRIPT DE INSTALACIÓN COMPLETA
# Para: Maxi en Ubuntu
# Qué hace: Instala TODO automáticamente
# ============================================================

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     TaskFlow Pro — Instalación Completa Ubuntu       ║"
echo "║                                                      ║"
echo "║  Este script hace TODO automáticamente por ti:       ║"
echo "║  1. Instala dependencias del backend                 ║"
echo "║  2. Configura variables de entorno                   ║"
echo "║  3. Instala dependencias del frontend                ║"
echo "║  4. Levanta el sistema completo                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Colores para los mensajes
ROJO='\033[0;31m'
VERDE='\033[0;32m'
AMARILLO='\033[1;33m'
NC='\033[0m' # Sin color

# ============================================================
# PASO 0: Verificar que estamos en el lugar correcto
# ============================================================

if [ ! -d "taskflow" ]; then
    echo -e "${ROJO}❌ ERROR: No encuentro la carpeta 'taskflow'${NC}"
    echo "Estoy en: $(pwd)"
    echo ""
    echo "Debería estar en: ~/Documentos/SistemaContable/taskflow-backend"
    echo ""
    echo "Solución: cd ~/Documentos/SistemaContable/taskflow-backend"
    exit 1
fi

echo -e "${VERDE}✅ Encontré la carpeta taskflow${NC}"
echo "   Ubicación: $(pwd)/taskflow"
echo ""

# ============================================================
# PASO 1: BACKEND (Python / FastAPI)
# ============================================================

echo -e "${AMARILLO}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${AMARILLO}PASO 1: INSTALANDO BACKEND (Python)${NC}"
echo -e "${AMARILLO}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd taskflow/backend

# 1.1 Crear entorno virtual
echo "📦 Creando entorno virtual Python..."
python3 -m venv venv
source venv/bin/activate

# 1.2 Actualizar pip
echo "📦 Actualizando pip..."
pip install --upgrade pip -q

# 1.3 Instalar dependencias
echo "📦 Instalando dependencias del backend..."
pip install -r requirements.txt -q

if [ $? -eq 0 ]; then
    echo -e "${VERDE}✅ Backend instalado correctamente${NC}"
else
    echo -e "${ROJO}❌ Error al instalar backend${NC}"
    exit 1
fi

# 1.4 Crear archivo .env
if [ ! -f ".env" ]; then
    echo ""
    echo -e "${AMARILLO}⚠️  NECESITÁS COMPLETAR ESTO MANUALMENTE:${NC}"
    echo ""
    echo "Abrí este archivo en el editor:"
    echo "   ~/Documentos/SistemaContable/taskflow-backend/taskflow/backend/.env"
    echo ""
    echo "Y completá estas líneas:"
    echo ""
    echo "   DATABASE_URL=postgresql://postgres:TU_PASSWORD@db.XXXX.supabase.co:5432/postgres"
    echo "   SECRET_KEY=una-frase-larga-y-secreta"
    echo "   GOOGLE_CLIENT_ID=XXXX.apps.googleusercontent.com"
    echo "   GOOGLE_CLIENT_SECRET=XXXX"
    echo "   FRONTEND_URL=http://localhost:3000"
    echo "   ENVIRONMENT=development"
    echo ""
    echo "Después presioná Enter aquí para continuar..."
    read
else
    echo -e "${VERDE}✅ Archivo .env ya existe${NC}"
fi

echo ""

# ============================================================
# PASO 2: FRONTEND (React / Node)
# ============================================================

echo -e "${AMARILLO}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${AMARILLO}PASO 2: INSTALANDO FRONTEND (React)${NC}"
echo -e "${AMARILLO}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd ../frontend

# 2.1 Instalar dependencias Node
echo "📦 Instalando dependencias del frontend..."
npm install -q

if [ $? -eq 0 ]; then
    echo -e "${VERDE}✅ Frontend instalado correctamente${NC}"
else
    echo -e "${ROJO}❌ Error al instalar frontend${NC}"
    exit 1
fi

# 2.2 Crear .env.local si no existe
if [ ! -f ".env.local" ]; then
    echo ""
    echo -e "${AMARILLO}⚠️  NECESITÁS COMPLETAR ESTO MANUALMENTE:${NC}"
    echo ""
    echo "Abrí este archivo:"
    echo "   ~/Documentos/SistemaContable/taskflow-backend/taskflow/frontend/.env.local"
    echo ""
    echo "Y completá esta línea:"
    echo ""
    echo "   VITE_GOOGLE_CLIENT_ID=XXXX.apps.googleusercontent.com"
    echo ""
    echo "Después presioná Enter aquí para continuar..."
    read
else
    echo -e "${VERDE}✅ Archivo .env.local ya existe${NC}"
fi

echo ""

# ============================================================
# PASO 3: CREAR SCRIPT DE INICIO RÁPIDO
# ============================================================

echo -e "${AMARILLO}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${AMARILLO}PASO 3: CREANDO SCRIPT DE INICIO RÁPIDO${NC}"
echo -e "${AMARILLO}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd ../..

cat > iniciar_sistema.sh << 'EOF'
#!/bin/bash

# Script para iniciar TaskFlow Pro en desarrollo

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        TaskFlow Pro — Sistema iniciando...           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Activar entorno virtual del backend
cd taskflow/backend
source venv/bin/activate
echo "🐍 Entorno virtual Python activado"

# Iniciar backend en background
echo "🚀 Iniciando Backend en puerto 8000..."
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo ""

# Iniciar frontend
cd ../frontend
echo "⚡ Iniciando Frontend en puerto 3000..."
npm run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
echo ""

echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅ SISTEMA LISTO                                   ║"
echo "║                                                      ║"
echo "║  🌐 Frontend:  http://localhost:3000                 ║"
echo "║  🔌 Backend:   http://localhost:8000                 ║"
echo "║  📚 API Docs:  http://localhost:8000/docs            ║"
echo "║                                                      ║"
echo "║  Presioná Ctrl+C para detener todo                   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Limpiar al salir
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Sistema detenido.'" EXIT

wait
EOF

chmod +x iniciar_sistema.sh

echo -e "${VERDE}✅ Script 'iniciar_sistema.sh' creado${NC}"
echo ""

# ============================================================
# RESUMEN FINAL
# ============================================================

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           ✅ INSTALACIÓN COMPLETADA                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

echo -e "${VERDE}¿QUÉ COMPLETASTE?${NC}"
echo "  ✅ Python instalado"
echo "  ✅ Node instalado"
echo "  ✅ Todas las dependencias"
echo "  ✅ Script automático creado"
echo ""

echo -e "${AMARILLO}¿QUÉ FALTA?${NC}"
echo "  ⏳ Completar archivo .env (Backend) — SI NO LO HICISTE"
echo "  ⏳ Completar archivo .env.local (Frontend) — SI NO LO HICISTE"
echo "  ⏳ Asegurarte que Supabase está configurado"
echo ""

echo -e "${VERDE}¿CÓMO INICIAR EL SISTEMA?${NC}"
echo ""
echo "  OPCIÓN 1 (Lo más fácil):"
echo "    cd ~/Documentos/SistemaContable/taskflow-backend"
echo "    bash iniciar_sistema.sh"
echo ""
echo "  OPCIÓN 2 (Manual, si lo anterior no funciona):"
echo ""
echo "    Terminal 1 (Backend):"
echo "      cd ~/Documentos/SistemaContable/taskflow-backend/taskflow/backend"
echo "      source venv/bin/activate"
echo "      uvicorn main:app --reload --port 8000"
echo ""
echo "    Terminal 2 (Frontend):"
echo "      cd ~/Documentos/SistemaContable/taskflow-backend/taskflow/frontend"
echo "      npm run dev"
echo ""

echo -e "${VERDE}PRÓXIMOS PASOS:${NC}"
echo "  1. Verificá que Supabase funciona (creaste la BD)"
echo "  2. Verificá Google OAuth (tienes CLIENT_ID)"
echo "  3. Inicia el sistema con bash iniciar_sistema.sh"
echo "  4. Abrí en el navegador: http://localhost:3000"
echo ""

echo "¿Preguntas? Revisá: taskflow/docs/02_GUIA_INSTALACION.md"
echo ""
