#!/bin/bash
# TaskFlow Pro — Inicio rápido en desarrollo local
# Ejecutar desde la carpeta raíz del proyecto: bash iniciar_local.sh

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       TaskFlow Pro — Inicio local        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Verificar Python ───────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "❌ Python 3 no encontrado. Instalalo desde https://python.org"
  exit 1
fi
echo "✅ Python: $(python3 --version)"

# ── Verificar Node ─────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌ Node.js no encontrado. Instalalo desde https://nodejs.org"
  exit 1
fi
echo "✅ Node.js: $(node --version)"

# ── Backend ────────────────────────────────────────────────
echo ""
echo "📦 Instalando dependencias del backend..."
cd backend
pip install -r requirements.txt -q

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo "⚠️  Creé el archivo backend/.env"
  echo "   Completá DATABASE_URL, GOOGLE_CLIENT_ID y SECRET_KEY antes de continuar."
  echo "   Después ejecutá este script de nuevo."
  exit 0
fi

echo "🚀 Iniciando backend en http://localhost:8000 ..."
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "   PID del backend: $BACKEND_PID"

# ── Frontend ───────────────────────────────────────────────
cd ../frontend
echo ""
echo "📦 Instalando dependencias del frontend..."
npm install -q

if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo ""
  echo "⚠️  Creé el archivo frontend/.env.local"
  echo "   Completá VITE_GOOGLE_CLIENT_ID."
fi

echo "🚀 Iniciando frontend en http://localhost:3000 ..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Sistema corriendo en:                   ║"
echo "║  Frontend: http://localhost:3000          ║"
echo "║  Backend:  http://localhost:8000          ║"
echo "║  API Docs: http://localhost:8000/docs     ║"
echo "║                                          ║"
echo "║  Presioná Ctrl+C para detener todo       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Esperar y limpiar al cerrar
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Sistema detenido.'" EXIT
wait
