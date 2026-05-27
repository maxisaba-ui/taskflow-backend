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
