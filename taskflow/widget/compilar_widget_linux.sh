#!/bin/bash
# ============================================================
# TaskFlow Pro — Compilar Widget en Linux (para testing en VM)
# El binario resultante es para Linux, NO para Windows.
# Para el .exe de Windows usar compilar_widget.bat en Windows.
# ============================================================

set -e
cd "$(dirname "$0")"

echo "============================================"
echo " TaskFlow Pro — Compilando Widget Linux"
echo "============================================"
echo

echo "[1/3] Instalando dependencias..."
pip3 install --break-system-packages PyQt6 requests pyinstaller 2>/dev/null || \
pip3 install PyQt6 requests pyinstaller
echo "     OK"

echo "[2/3] Limpiando builds anteriores..."
rm -rf dist/ build/ 2>/dev/null || true
echo "     OK"

echo "[3/3] Compilando..."
pyinstaller \
    --onefile \
    --windowed \
    --name="TaskFlowWidget" \
    --hidden-import=PyQt6.sip \
    widget.py

echo
echo "============================================"
echo " LISTO! Binario en: dist/TaskFlowWidget"
echo " (solo funciona en Linux)"
echo " Para Windows: usar compilar_widget.bat"
echo "============================================"
