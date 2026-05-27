# TaskFlow Pro — Documento de Análisis Funcional
**Versión:** 1.0  
**Fecha:** 2025  
**Destinatario:** Propietario del sistema  
**Autor:** Análisis generado automáticamente

---

## ¿Qué es este documento?

Este documento explica, en lenguaje sencillo, qué hace el sistema, cómo está organizado y qué necesitamos para construirlo. Pensalo como el "plano de arquitecto" antes de construir una casa: primero se dibuja todo, luego se construye.

---

## 1. NOMBRE DEL SISTEMA

**TaskFlow Pro** — Sistema de gestión de tareas, recursos y clientes para estudios contables.

El nombre de la empresa y el logo son configurables desde la pantalla de administración. No hay que tocar código para cambiarlo.

---

## 2. PROPÓSITO DEL SISTEMA

El sistema resuelve tres problemas concretos:

1. **Control de tiempo real**: Saber exactamente qué está haciendo cada persona de tu equipo, cuándo empezó y cuándo terminó cada tarea.
2. **Planificación anticipada**: Cargar las tareas del mes completo con anticipación, que el sistema sepa cuáles corresponden a cada cliente y que avise cuando algo está por vencer.
3. **Métricas para mejorar**: Al final del día, semana o mes, tener números concretos sobre eficiencia, tiempo por cliente, tiempo por tipo de tarea.

---

## 3. TECNOLOGÍAS ELEGIDAS (y por qué son gratuitas)

### 3.1 Backend (el "cerebro" del sistema)
- **Lenguaje:** Python 3.11
- **Framework:** FastAPI
- **Por qué:** Es moderno, rápido, con documentación automática, y tiene una comunidad enorme. Es gratuito y de código abierto.

### 3.2 Base de datos
- **Motor:** PostgreSQL
- **Dónde:** Supabase (nube gratuita)
- **Por qué:** Supabase ofrece plan gratuito con 500MB de almacenamiento y 50.000 filas. Para 20 usuarios con 15 tareas diarias, esto alcanza para varios años.
- **URL:** https://supabase.com

### 3.3 Frontend (la pantalla que ve el usuario)
- **Framework:** React 18 + Vite
- **Estilos:** TailwindCSS
- **Dónde se aloja:** Vercel (gratuito para proyectos pequeños)
- **URL:** https://vercel.com

### 3.4 Backend hosting (dónde corre el servidor)
- **Opción:** Railway.app (plan gratuito: 500 horas/mes)
- **Alternativa:** Render.com (plan gratuito con 750 horas/mes)
- **URL:** https://railway.app

### 3.5 Widget de escritorio Windows
- **Framework:** Python + PyQt6 (o Electron como alternativa)
- **Distribución:** Instalador .exe generado con PyInstaller
- **Costo:** Totalmente gratuito

### 3.6 Autenticación
- **Google OAuth 2.0** — gratuito para uso no comercial de pequeña escala
- Lista blanca interna: solo los usuarios registrados en el sistema pueden entrar aunque tengan cuenta Google

---

## 4. PERFILES DE USUARIO

El sistema tiene 4 perfiles. Un usuario puede tener más de uno al mismo tiempo.

| Perfil | ¿Qué puede hacer? |
|--------|-------------------|
| **Operador** | Ver sus propias tareas, iniciar/pausar/finalizar, agregar tareas propias, ver su historial |
| **Supervisor** | Todo lo del operador + ver el estado de sus operadores, asignar tareas, ver métricas de su equipo |
| **Dueño** | Todo lo del supervisor + ver métricas de toda la empresa, acceder a reportes globales |
| **Administrador** | Todo lo anterior + configurar parámetros del sistema (feriados, empresa, logos, usuarios) |

### 4.1 Relación supervisor-operador
- Un operador puede tener más de un supervisor.
- Un supervisor puede tener más de un operador.
- El supervisor solo ve a sus operadores asignados.
- El dueño ve a todos.

---

## 5. MÓDULOS DEL SISTEMA

### MÓDULO 1: Gestión de usuarios y acceso

**¿Qué hace?**
- Permite entrar con cuenta de Google
- Verifica que el email esté en la lista de usuarios permitidos del sistema
- Asigna el perfil correspondiente
- Mantiene un registro de quién entró, cuándo y desde dónde

**Campos de un usuario:**
- Email (viene de Google)
- Nombre y apellido
- Foto de perfil (viene de Google)
- Perfil/s asignados (operador, supervisor, dueño, administrador)
- Supervisor/s asignados (si es operador)
- Horario de inicio de jornada (default del sistema o personalizado)
- Horario de fin de jornada
- Fecha de alta en el sistema
- Fecha de baja (para desactivar sin borrar)
- Estado (activo/inactivo)

---

### MÓDULO 2: Parámetros del sistema

**¿Qué hace?**
Permite al administrador configurar todo el comportamiento del sistema sin tocar código.

**Parámetros generales:**
- Nombre de la empresa (aparece en todos los reportes)
- Logo de la empresa (imagen que aparece en cabeceras)
- Horario de jornada laboral por defecto (ej: 9:00 a 18:00)
- Zona horaria
- Formato de fecha (DD/MM/AAAA para Argentina)

**Feriados:**
- Carga anual de feriados nacionales
- Feriados locales o de la empresa
- El sistema los usa para calcular "días hábiles"

**Tipos de tarea (rubros):**
- Impuestos
- Contabilidad
- Auditoría
- Liquidación de sueldos
- Sindicatos
- (Configurables, se pueden agregar más)

---

### MÓDULO 3: Clientes

**¿Qué hace?**
Mantiene el inventario completo de clientes del estudio.

**Campos de un cliente:**
- Razón social / Nombre
- CUIT/CUIL
- Dirección
- Teléfonos
- Email de contacto
- Responsable interno (qué empleado es el principal responsable)
- Servicios/procedimientos contratados
- Fecha de alta
- Fecha de baja (para desactivar sin perder historia)
- Estado activo/inactivo
- Notas internas

**Regla importante:** Un cliente nunca se borra físicamente del sistema. Se "da de baja" pero toda su historia de tareas queda guardada.

---

### MÓDULO 4: Servicios y Procedimientos

**¿Qué hace?**
Define los tipos de trabajo que ofrece el estudio. Cada servicio tiene una lista de tareas predefinidas con sus reglas de cuándo deben hacerse.

**Ejemplo de servicio:** "Liquidación de sueldos mensual"
- Tarea 1: Recepción de novedades (ocurre cuando el cliente la manda)
- Tarea 2: Liquidación (límite: 1 día hábil después de recibir novedades)
- Tarea 3: Revisión (límite: 1 día hábil después de liquidar)
- Tarea 4: Envío al cliente

**Tipos de reglas para cuándo aparece una tarea:**
- Fecha fija del mes (ej: el día 10 de cada mes)
- Día hábil del mes (ej: el 5° día hábil)
- X días hábiles antes de una fecha de vencimiento (hacia atrás)
- X días hábiles después de completar la etapa anterior (hacia adelante)
- Sin regla (aparece cuando el cliente genera el evento)

---

### MÓDULO 5: Tareas

**¿Qué hace?**
Es el corazón del sistema. Gestiona todas las tareas del día a día.

**Campos de una tarea:**
- Nombre de la tarea (de la lista de tareas parametrizadas)
- Cliente asociado (puede no tener cliente)
- Servicio/procedimiento asociado (opcional)
- Rubro (impuestos, contabilidad, etc.)
- Usuario asignado (a quién le toca hacer la tarea)
- Supervisor que la asignó
- Fecha planificada
- Prioridad (alta/media/baja)
- Estado: pendiente / en curso / pausada / completada / vencida
- Fecha y hora de inicio real (cuando el operador aprieta "play")
- Fecha y hora de fin real
- Tiempo total trabajado (calculado)
- Comentario del supervisor (instrucciones, notas)
- Comentario del operador (qué pasó durante la tarea)
- Motivo de pausa (si la pausaron)
- Es repetitiva? (se hereda al día siguiente si no se completa)
- Ingresada por: supervisor / propio operador
- Modificable por el operador: sí/no

**Reglas de modificación:**
- El operador NO puede eliminar tareas asignadas por un supervisor
- El operador SÍ puede eliminar tareas que él mismo agregó para sí mismo
- El operador SÍ puede agregar tareas propias
- El operador NO puede cambiar el cliente o el rubro de una tarea asignada por supervisor

**Herencia de tareas:**
Al cerrar el día, todas las tareas en estado "pendiente" o "en curso" que no se completaron, se copian automáticamente al día siguiente con estado "pendiente" y una marca de "heredada del DD/MM".

---

### MÓDULO 6: Widget de escritorio Windows

**¿Qué hace?**
Es un pequeño programa que se instala en la computadora de cada operador. Aparece como un ícono en la barra de tareas. Permite controlar las tareas sin abrir el navegador.

**Funciones del widget:**
- Ver la lista de tareas del día
- Iniciar una tarea (play) — registra hora de inicio
- Pausar una tarea — pide motivo de pausa
- Reanudar una tarea pausada
- Finalizar una tarea — registra hora de fin
- Ver el estado de todas sus tareas del día
- Opción "Fin de jornada" — registra cierre del día, pide comentario si termina antes o después del horario

**El widget se conecta al mismo servidor** que la web. Es solo una "pantalla diferente" para ver los mismos datos.

---

### MÓDULO 7: Seguimiento de tareas complejas

**¿Qué hace?**
Para ciertas tareas importantes (como liquidación de sueldos, presentaciones sindicales) que tienen etapas, plazos y consecuencias si no se cumplen, el sistema lleva un seguimiento especial con semáforo de colores.

**Estados visuales:**
- 🟢 **Verde**: Completado a tiempo
- 🟡 **Amarillo/Naranja**: Debe hacerse hoy (atención!)
- 🔴 **Rojo**: Vencido o completado fuera de término (falta)
- ⚪ **Gris**: Pendiente, con tiempo suficiente

**Tipos de seguimiento:**
1. **Hacia adelante**: Liquidación de sueldos — cada etapa empieza cuando termina la anterior
2. **Hacia atrás (Gantt inverso)**: Presentaciones sindicales — se calculan fechas desde el vencimiento hacia atrás

---

### MÓDULO 8: Métricas y Reportes

**¿Qué hace?**
Genera los informes que permiten entender cómo se está usando el tiempo en la empresa.

**Reportes por operador (diario):**
- Hora de inicio de jornada (primera tarea del día)
- Hora de fin de jornada (última tarea del día)
- Total de horas trabajadas en tareas
- Horas sin tareas registradas (brechas)
- Brecha más larga sin tareas
- Comparación contra jornada esperada (llegó tarde? se fue antes?)

**Reportes por operador (mensual):**
- Días trabajados
- Horas totales
- Horas en tareas planificadas vs. no planificadas
- Día que empezó más temprano / más tarde
- Día que terminó más temprano / más tarde

**Reportes por cliente:**
- Total de horas dedicadas al cliente en el mes
- Desglose por rubro (cuánto de impuestos, cuánto de contabilidad)
- Desglose por tipo de tarea

**Reportes por tipo de tarea:**
- Cuánto tiempo total se dedica a "Liquidación de sueldos" en el mes, sin importar el cliente

**Reportes cruzados:**
- Comparativo entre operadores
- Comparativo entre clientes
- Gráficos de torta y barras

**Exportación:**
- PDF descargable
- Envío por email (diario, semanal, mensual)

---

## 6. REGLAS DE NEGOCIO IMPORTANTES

1. **Días hábiles**: El sistema conoce los feriados. Cuando una regla dice "3 días hábiles", no cuenta sábados, domingos ni feriados.

2. **Alta/baja lógica**: Ningún dato importante se borra nunca. Todo tiene fecha de alta y fecha de baja. Si un cliente deja de ser cliente, se "inactiva" pero su historia queda.

3. **Auditoría**: Cada vez que alguien modifica un dato importante, el sistema guarda: quién lo hizo, cuándo, qué dato cambió (el valor anterior y el nuevo).

4. **Timestamps**: Toda fecha y hora se guarda con zona horaria de Argentina (UTC-3).

5. **Herencia de tareas**: Al cierre del día (configurable, por ejemplo a las 23:59), las tareas incompletas se pasan automáticamente al día siguiente. Esto es automático.

6. **Notificaciones de vencimiento**: El sistema avisa (en el widget y en la web) cuando una tarea de seguimiento complejo está por vencer o ya venció.

---

## 7. LO QUE EL SISTEMA NO HACE (límites)

- No factura ni genera documentos contables
- No reemplaza el software contable (no es Tango ni Bejerman)
- No gestiona pagos ni cobros
- No tiene app mobile (solo web + widget Windows)
- No tiene videoconferencias ni chat interno

---

## 8. FLUJO DE TRABAJO TÍPICO DE UN DÍA

```
07:00 - El supervisor carga las tareas del día (o ya las cargó la semana anterior)
09:00 - El operador abre el widget
09:05 - Aprieta "Play" en la primera tarea → el sistema registra 09:05 como hora de inicio
10:30 - Pausa la tarea (motivo: "reunión con cliente")
10:45 - Reanuda la tarea
11:00 - Finaliza la tarea → el sistema calcula 1h50min de trabajo
11:01 - Empieza la siguiente tarea
...
18:00 - Aprieta "Fin de jornada" en el widget
18:00 - El sistema calcula el resumen del día
23:59 - Las tareas incompletas pasan automáticamente al día siguiente
```

---

*Siguiente documento: 02_DER_BASE_DE_DATOS.md — Diagrama Entidad-Relación*
