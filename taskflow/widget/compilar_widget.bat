@echo off
:: TaskFlow Pro — Script para generar el instalador .exe del Widget
:: Ejecutar este archivo haciendo doble clic desde Windows

echo ============================================
echo  TaskFlow Pro — Compilando Widget Windows
echo ============================================
echo.

:: Verificar que Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no está instalado o no está en el PATH.
    echo Instalalo desde https://python.org y marcá "Add to PATH"
    pause
    exit /b 1
)

echo [1/3] Instalando dependencias...
pip install PyQt6 requests pyinstaller --quiet
echo      OK

echo [2/3] Compilando el widget...
pyinstaller ^
    --onefile ^
    --windowed ^
    --name="TaskFlow Widget" ^
    --icon=icon.ico ^
    --add-data "icon.ico;." ^
    widget.py

if errorlevel 1 (
    echo ERROR: Falló la compilación. Revisá los mensajes de arriba.
    pause
    exit /b 1
)

echo [3/3] Copiando el ejecutable...
if not exist "..\dist" mkdir "..\dist"
copy "dist\TaskFlow Widget.exe" "..\TaskFlow_Widget_Instalable.exe" >nul

echo.
echo ============================================
echo  LISTO! El archivo está en:
echo  TaskFlow_Widget_Instalable.exe
echo  
echo  Distribuiló a cada empleado para que
echo  lo instalen en su computadora.
echo ============================================
pause
