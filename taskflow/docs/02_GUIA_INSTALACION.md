# GUÍA DE INSTALACIÓN COMPLETA — TaskFlow Pro
## Para personas sin experiencia en programación
### Versión 1.0 — Todo gratuito en la nube

---

> 📌 **Tiempo estimado total: 2 a 3 horas**
> No se necesita saber programar. Seguí cada paso exactamente como está escrito.
> Si algo falla, el mensaje de error te dice dónde está el problema.

---

## ¿QUÉ VAMOS A INSTALAR Y DÓNDE?

| Componente | Qué es | Dónde va | Costo |
|---|---|---|---|
| Base de datos (PostgreSQL) | Donde se guardan todos los datos | Supabase (nube) | GRATIS |
| Backend (servidor API) | El cerebro del sistema | Railway.app (nube) | GRATIS |
| Frontend (pantalla web) | Lo que ven los usuarios | Vercel (nube) | GRATIS |
| Widget Windows | Programita de escritorio | PC de cada usuario | GRATIS |
| Google OAuth | Sistema de login | Google Cloud | GRATIS |

---

## PASO 1: CREAR LA BASE DE DATOS EN SUPABASE

### 1.1 Crear tu cuenta
1. Abrí el navegador y entrá a **https://supabase.com**
2. Hacé clic en **"Start your project"** (botón verde)
3. Iniciá sesión con tu cuenta de GitHub o Google (si no tenés GitHub, créate uno en github.com — es gratis)
4. Una vez dentro, hacé clic en **"New project"**

### 1.2 Configurar el proyecto
Completá el formulario:
- **Organization**: (dejá el que aparece)
- **Name**: `taskflow-pro`
- **Database Password**: Escribí una contraseña SEGURA. Anotala en un papel físico. Ej: `MiEstudio2025@DB`
- **Region**: `South America (São Paulo)` — la más cercana a Argentina
- Hacé clic en **"Create new project"**
- Esperá 2-3 minutos mientras crea todo (se ve una barra de progreso)

### 1.3 Ejecutar el script de base de datos
1. Una vez creado, en el menú izquierdo buscá **"SQL Editor"** (ícono de código `</>`)
2. Hacé clic en **"+ New query"**
3. Abrí el archivo `scripts/01_crear_base_de_datos.sql` con el Bloc de Notas
4. Seleccioná TODO el texto (Ctrl+A) y copialo (Ctrl+C)
5. Pegalo en el editor de Supabase (Ctrl+V)
6. Hacé clic en el botón **"Run"** (ícono de play ▶)
7. Abajo debería aparecer: `Tablas creadas: 15` (o un número similar)
8. Si dice "Success" en verde: ✅ base de datos lista

### 1.4 Obtener la URL de conexión
1. En el menú izquierdo, ir a **"Project Settings"** → **"Database"**
2. Buscá la sección **"Connection string"** → **"URI"**
3. Copiá ese texto. Se ve así:
   ```
   postgresql://postgres:[TU-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
4. Guardalo en un archivo de texto. Lo vas a necesitar en el Paso 3.

---

## PASO 2: CONFIGURAR GOOGLE PARA EL LOGIN

> Esto permite que los usuarios entren al sistema con su cuenta de Google.

### 2.1 Crear proyecto en Google Cloud
1. Entrá a **https://console.cloud.google.com**
2. Iniciá sesión con tu cuenta de Google
3. Arriba, hacé clic en el selector de proyectos → **"Nuevo proyecto"**
4. Nombre: `TaskFlow Pro` → Hacé clic en **"Crear"**

### 2.2 Activar Google+ API
1. En el menú izquierdo, **"APIs y servicios"** → **"Biblioteca"**
2. Buscá **"Google Identity"** → Hacé clic en **"Habilitar"**

### 2.3 Crear credenciales OAuth
1. **"APIs y servicios"** → **"Credenciales"**
2. Hacé clic en **"+ Crear credenciales"** → **"ID de cliente OAuth"**
3. Si te pide configurar la pantalla de consentimiento:
   - Tipo: **"Externo"**
   - Nombre de la app: `TaskFlow Pro`
   - Email de soporte: tu email
   - Guardá y continuá
4. Tipo de aplicación: **"Aplicación web"**
5. Nombre: `TaskFlow Web`
6. En **"Orígenes de JavaScript autorizados"** agregá:
   - `http://localhost:3000`
   - `https://tu-app.vercel.app` ← (la URL que obtenés en el Paso 4, podés completarla después)
7. En **"URIs de redireccionamiento autorizados"** agregá:
   - `http://localhost:3000`
   - `https://tu-app.vercel.app`
8. Hacé clic en **"Crear"**
9. Aparece un popup con **"ID de cliente"** y **"Secreto de cliente"**. Guardá ambos.

---

## PASO 3: SUBIR EL BACKEND A RAILWAY

### 3.1 Preparar el código
1. Descargá e instalá **Git** desde https://git-scm.com/download/win
2. Creá una cuenta en **https://github.com** (si no tenés)
3. En GitHub, hacé clic en **"+"** → **"New repository"**
4. Nombre: `taskflow-backend`
5. Visibilidad: **Private**
6. Hacé clic en **"Create repository"**

### 3.2 Subir el código del backend
1. Instalá **Node.js** desde https://nodejs.org (versión LTS)
2. Abrí **Git Bash** (busca en el menú inicio de Windows)
3. Navegá a la carpeta del proyecto:
   ```bash
   cd /ruta/a/tu/carpeta/taskflow/backend
   ```
4. Ejecutá estos comandos uno por uno:
   ```bash
   git init
   git add .
   git commit -m "Primera versión TaskFlow Pro"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/taskflow-backend.git
   git push -u origin main
   ```
5. Te va a pedir usuario y contraseña de GitHub

### 3.3 Crear el servicio en Railway
1. Entrá a **https://railway.app**
2. Hacé clic en **"Login"** → **"Login with GitHub"**
3. Autorizá Railway para acceder a tu GitHub
4. Hacé clic en **"New Project"**
5. Seleccioná **"Deploy from GitHub repo"**
6. Elegí `taskflow-backend`
7. Railway detecta automáticamente que es Python y empieza a instalarlo

### 3.4 Configurar las variables de entorno
1. En Railway, hacé clic en tu servicio → **"Variables"**
2. Agregá estas variables (botón **"+ New Variable"** para cada una):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La URL de Supabase del Paso 1.4 |
   | `SECRET_KEY` | Una frase larga y secreta. Ej: `mi-clave-super-secreta-2025-taskflow-pro` |
   | `GOOGLE_CLIENT_ID` | El ID de cliente del Paso 2.3 |
   | `GOOGLE_CLIENT_SECRET` | El secreto de cliente del Paso 2.3 |
   | `ENVIRONMENT` | `production` |
   | `FRONTEND_URL` | (lo completás después con la URL de Vercel) |

3. Hacé clic en **"Deploy"**
4. Esperá 3-5 minutos. Cuando aparezca el ícono verde, el backend está funcionando.
5. **Copiá la URL del backend**. Se ve así: `https://taskflow-backend-production.up.railway.app`

### 3.5 Verificar que funciona
1. Abrí el navegador y entrá a: `https://TU-URL-RAILWAY/health`
2. Debería aparecer: `{"status": "ok"}`
3. Si aparece eso: ✅ Backend funcionando

---

## PASO 4: SUBIR EL FRONTEND A VERCEL

### 4.1 Crear repositorio del frontend
Igual que el Paso 3.1 pero con la carpeta `taskflow/frontend`:
```bash
cd /ruta/a/tu/carpeta/taskflow/frontend
git init
git add .
git commit -m "Frontend TaskFlow Pro"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/taskflow-frontend.git
git push -u origin main
```

### 4.2 Crear proyecto en Vercel
1. Entrá a **https://vercel.com**
2. **"Sign Up"** → **"Continue with GitHub"**
3. **"Add New Project"** → **"Import"** junto a `taskflow-frontend`
4. En **"Environment Variables"** agregá:

   | Variable | Valor |
   |---|---|
   | `VITE_API_URL` | URL de Railway del Paso 3.5. Ej: `https://taskflow-backend-production.up.railway.app/api/v1` |
   | `VITE_GOOGLE_CLIENT_ID` | El ID de cliente de Google del Paso 2.3 |

5. Hacé clic en **"Deploy"**
6. Esperá 2-3 minutos
7. Vercel te da una URL. Ej: `https://taskflow-frontend.vercel.app`
8. **Guardá esta URL** — es la dirección del sistema

### 4.3 Actualizar URLs en Google
1. Volvé a https://console.cloud.google.com → Credenciales
2. Editá el cliente OAuth que creaste
3. Reemplazá `https://tu-app.vercel.app` por tu URL real de Vercel en ambos campos
4. Guardá

### 4.4 Actualizar URL en Railway
1. Volvé a Railway → Variables
2. Actualizá `FRONTEND_URL` con tu URL de Vercel
3. Railway redeploya automáticamente

---

## PASO 5: CREAR EL PRIMER USUARIO ADMINISTRADOR

> El sistema tiene lista blanca: nadie puede entrar si no está registrado.
> El primer usuario hay que crearlo directamente en la base de datos.

### 5.1 Registrar el primer admin en Supabase
1. Volvé a **Supabase** → **SQL Editor**
2. Ejecutá este script (reemplazá los datos):
```sql
-- 1. Insertar el primer usuario administrador
INSERT INTO usuarios (email, nombre, apellido, activo, fecha_alta)
VALUES (
    'tu-email@gmail.com',    -- TU EMAIL DE GOOGLE
    'Tu Nombre',              -- TU NOMBRE
    'Tu Apellido',            -- TU APELLIDO
    TRUE,
    CURRENT_DATE
);

-- 2. Asignarle el perfil de administrador
INSERT INTO usuario_perfiles (usuario_id, perfil_id, activo, fecha_alta)
SELECT 
    u.id,
    p.id,
    TRUE,
    CURRENT_DATE
FROM usuarios u
CROSS JOIN perfiles p
WHERE u.email = 'tu-email@gmail.com'  -- TU EMAIL
  AND p.codigo = 'administrador';

-- 3. También darle perfil de dueño
INSERT INTO usuario_perfiles (usuario_id, perfil_id, activo, fecha_alta)
SELECT 
    u.id,
    p.id,
    TRUE,
    CURRENT_DATE
FROM usuarios u
CROSS JOIN perfiles p
WHERE u.email = 'tu-email@gmail.com'  -- TU EMAIL
  AND p.codigo = 'dueno';
```
3. Hacé clic en **"Run"**

### 5.2 Probar el login
1. Abrí tu URL de Vercel en el navegador
2. Hacé clic en **"Iniciar sesión con Google"**
3. Elegí tu cuenta de Google
4. Si todo funcionó: deberías ver el dashboard del sistema ✅

---

## PASO 6: INSTALAR EL WIDGET EN WINDOWS

> El widget es un programita que se instala en la computadora de cada empleado.
> Permite controlar las tareas sin abrir el navegador.

### 6.1 Instalar Python (una sola vez por PC)
1. Entrá a **https://python.org/downloads**
2. Descargá **Python 3.12** (el botón amarillo grande)
3. Ejecutá el instalador
4. ⚠️ **MUY IMPORTANTE**: En la primera pantalla, tildá **"Add Python to PATH"** antes de hacer clic en Install
5. Hacé clic en **"Install Now"**

### 6.2 Instalar dependencias del widget
1. Abrí **Símbolo del sistema** (buscá "cmd" en el menú inicio)
2. Ejecutá:
   ```
   pip install PyQt6 requests pyinstaller
   ```
3. Esperá que termine de instalar (puede tardar 3-5 minutos)

### 6.3 Configurar la URL del servidor
1. Abrí el archivo `widget/widget.py` con el Bloc de Notas
2. Buscá esta línea (está cerca del principio):
   ```python
   API_BASE_URL = "https://tu-backend.railway.app/api/v1"
   ```
3. Reemplazá `https://tu-backend.railway.app` por tu URL real de Railway
4. Guardá el archivo

### 6.4 Generar el instalador .exe
1. En Símbolo del sistema, navegá a la carpeta del widget:
   ```
   cd C:\ruta\a\taskflow\widget
   ```
2. Ejecutá:
   ```
   pyinstaller --onefile --windowed --name="TaskFlow Widget" widget.py
   ```
3. Esperá 2-3 minutos
4. El archivo `.exe` queda en la carpeta `dist/`
5. Ese archivo `TaskFlow Widget.exe` es el que se distribuye a cada empleado

### 6.5 Configurar el widget con el token de sesión
El widget necesita el token de autenticación. El flujo es:
1. El usuario entra al sistema web
2. En la web, va a su perfil → "Copiar token para widget"
3. En el widget, primer uso → pega el token
4. El token dura 8 horas (se renueva al volver a loguearse en la web)

---

## PASO 7: CONFIGURACIÓN INICIAL DEL SISTEMA

Una vez que ingresás como administrador:

### 7.1 Configurar la empresa
1. Ir a **Administración** → **Empresa**
2. Completar nombre de la empresa
3. Configurar horario de jornada por defecto (ej: 09:00 a 18:00)
4. Guardar

### 7.2 Cargar los feriados del año
1. Ir a **Administración** → **Feriados**
2. Los feriados de 2025 ya están precargados
3. Agregar feriados locales o de la empresa si corresponde

### 7.3 Registrar los usuarios del equipo
1. Ir a **Administración** → **Usuarios**
2. Para cada persona del equipo:
   - Email de Google (el que usan para Gmail)
   - Nombre y apellido
   - Perfil: Operador / Supervisor / Dueño
3. Guardar
4. Ese usuario ya puede entrar con su Google

### 7.4 Cargar los clientes
1. Ir a **Clientes**
2. Cargar cada cliente con sus datos

---

## PREGUNTAS FRECUENTES

**P: ¿Qué pasa si Vercel o Railway se caen?**
R: Son servicios con 99.9% de disponibilidad. Si hay mantenimiento, suelen ser minutos. El plan gratuito tiene alguna restricción de horas, pero para 20 usuarios con uso normal nunca se alcanza el límite.

**P: ¿Los datos están seguros?**
R: Sí. Supabase usa encriptación en reposo y en tránsito. Hacé backups mensuales desde Supabase → Settings → Backups.

**P: ¿Puedo cambiar el nombre de la empresa?**
R: Sí, desde Administración → Empresa, sin tocar nada de código.

**P: ¿Qué pasa cuando un empleado deja la empresa?**
R: Desde Administración → Usuarios → Desactivar. El empleado pierde acceso pero toda su historia queda guardada.

**P: ¿Puedo agregar más de 20 usuarios?**
R: Sí, el plan gratuito soporta bien hasta ~50 usuarios con este volumen de datos.

**P: ¿Hay que pagar algo?**
R: No. Todo es gratuito. Si el sistema crece mucho (cientos de usuarios, miles de tareas diarias), ahí sí conviene migrar a un plan pago de Railway (~$5/mes) para tener más recursos.

---

## SOPORTE

Si algo no funciona:
1. Revisá que la URL en las variables de entorno esté bien escrita (sin espacios al final)
2. Revisá que el email del usuario esté exactamente igual en Supabase que en su cuenta de Google
3. Los logs de Railway (pestaña "Logs") muestran los errores del servidor

---

*Fin de la guía de instalación — TaskFlow Pro v1.0*
