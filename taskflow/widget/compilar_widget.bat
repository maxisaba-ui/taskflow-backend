@echo off
:: ============================================================
:: TaskFlow Pro — Compilar Widget Windows
:: Ejecutar: doble clic desde la carpeta taskflow/widget/
:: Genera: TaskFlow_Widget.exe (portable, sin instalación)
:: ============================================================

echo ============================================
echo  TaskFlow Pro — Compilando Widget Windows
echo  Version: v2.0.0
echo ============================================
echo.

:: Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no encontrado. Instalar desde https://python.org
    echo        Marcar "Add Python to PATH" durante la instalacion.
    pause
    exit /b 1
)

:: Verificar pip
pip --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: pip no encontrado. Reinstalar Python con pip incluido.
    pause
    exit /b 1
)

echo [1/4] Instalando dependencias...
pip install PyQt6==6.7.1 requests==2.32.3 pyinstaller==6.10.0 --quiet
if errorlevel 1 (
    echo ADVERTENCIA: Algunos paquetes no se pudieron instalar. Continuando...
)
echo      OK

echo [2/4] Limpiando builds anteriores...
if exist "dist" rmdir /s /q "dist"
if exist "build" rmdir /s /q "build"
echo      OK

echo [3/4] Compilando widget (tarda 1-2 minutos)...
pyinstaller taskflow_widget.spec

if errorlevel 1 (
    echo.
    echo ERROR: La compilacion fallo. Posibles causas:
    echo   - PyQt6 no se instalo correctamente
    echo   - Falta el archivo icon.ico en esta carpeta
    echo   - Python 3.10+ requerido
    echo.
    echo Intentando compilacion alternativa sin spec...
    pyinstaller --onefile --windowed --name="TaskFlow Widget" --icon=icon.ico widget.py
    if errorlevel 1 (
        echo ERROR FATAL: No se pudo compilar.
        pause
        exit /b 1
    )
)

echo [4/4] Copiando ejecutable a raiz del proyecto...
if exist "dist\TaskFlow Widget.exe" (
    copy "dist\TaskFlow Widget.exe" "..\..\TaskFlow_Widget.exe" >nul
    echo.
    echo ============================================
    echo  LISTO! Ejecutable generado:
    echo.
    echo  taskflow/widget/dist/TaskFlow Widget.exe
    echo  (copia en raiz: TaskFlow_Widget.exe)
    echo.
    echo  Distribuir: copiar TaskFlow_Widget.exe
    echo  a la PC de cada empleado y ejecutar.
    echo  No requiere instalacion.
    echo ============================================
) else (
    echo ERROR: No se encontro el ejecutable compilado.
    echo Verificar carpeta dist/
)

pause
