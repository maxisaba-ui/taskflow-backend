# MANUAL DE USUARIO — TaskFlow Pro
## Guía completa para operadores, supervisores y administradores
### Versión 1.0

---

# PARTE 1: PARA OPERADORES

## ¿Qué es TaskFlow Pro?

TaskFlow Pro es el sistema que usa tu empresa para organizar el trabajo diario. Te permite:
- Ver cuáles son tus tareas de hoy
- Registrar exactamente cuándo empezás y terminás cada una
- Pausar una tarea si te interrumpen y retomarla después
- Agregar tus propias tareas cuando sea necesario

## Cómo entrar al sistema

### Por navegador web
1. Abrí tu navegador (Chrome, Firefox, Edge)
2. Entrá a la dirección del sistema (te la da tu supervisor)
3. Hacé clic en el botón azul **"Iniciar sesión con Google"**
4. Elegí tu cuenta de Google corporativa
5. Si tu email está registrado, entrás directamente al dashboard

> ⚠️ Si te aparece un mensaje de "Email no registrado", avisale a tu supervisor para que te dé de alta.

### Por el widget de escritorio
1. Buscá en tu escritorio el ícono de **TaskFlow Widget**
2. Hacé doble clic para abrirlo
3. Aparece un pequeño panel en la esquina de tu pantalla
4. La primera vez, ingresá tu token (te lo da el administrador)

---

## EL DASHBOARD (pantalla principal)

Cuando entrás, ves el dashboard. Tiene estas partes:

```
┌─────────────────────────────────────────────────┐
│  TaskFlow Pro           martes 15 de enero       │
│  👤 Juan Pérez                                   │
├─────────────────────────────────────────────────┤
│  [10 Total] [6 Completadas] [2 En curso]        │
│  [1 Pausada] [1 Pendiente] [0 Vencidas]         │
│                            [4h 30m registradas] │
├─────────────────────────────────────────────────┤
│  [Hoy] [Semana] [Mes]   Filtro: [Todos ▼]       │
├──────────────────────────┬──────────────────────┤
│                          │   RESUMEN DEL DÍA    │
│  📋 MIS TAREAS           │   Completadas: 60%   │
│                          │   ████████░░░░      │
│  ▌ Liquidación IVA       │                     │
│    📁 Cliente ABC        │   Total:      10    │
│    ▶ Iniciar             │   Completadas: 6    │
│                          │   En curso:    2    │
│  ▌ Conciliación Bancaria │   Pausadas:    1    │
│    📁 Empresa XYZ        │   Pendientes:  1    │
│    ⏸ Pausar  ⏹ Finalizar│   Vencidas:    0    │
│                          │   Horas:    4h 30m  │
└──────────────────────────┴──────────────────────┘
```

---

## CÓMO USAR LAS TAREAS

### Colores y estados de una tarea

| Color/Ícono | Estado | Qué significa |
|---|---|---|
| ⚪ Gris | Pendiente | Todavía no la empezaste |
| 🟢 Verde (parpadea) | En curso | Estás trabajando ahora |
| 🟡 Amarillo | Pausada | La interrumpiste |
| 🔵 Azul | Completada | Terminada con éxito |
| 🔴 Rojo | Vencida | La fecha pasó sin completarla |

### Iniciar una tarea (PLAY ▶)

1. Buscá la tarea en la lista
2. Hacé clic en el botón **"▶ Iniciar"** (verde)
3. El sistema registra exactamente la hora en que empezaste
4. El botón cambia a "⏸ Pausar" y "⏹ Finalizar"

> ✅ Importante: iniciá la tarea CUANDO REALMENTE LA ESTÁS EMPEZANDO, no antes.

### Pausar una tarea (⏸)

Cuando te interrumpen o necesitás hacer otra cosa:
1. Hacé clic en **"⏸ Pausar"**
2. Aparece un cuadro preguntando: **"¿Por qué pausás esta tarea?"**
3. Escribí el motivo (ej: "Llamada de cliente", "Almuerzo", "Reunión")
4. Hacé clic en **"Confirmar pausa"**
5. El tiempo de pausa NO se cuenta como tiempo trabajado

> El motivo es obligatorio. Ayuda a entender dónde se pierde el tiempo.

### Reanudar una tarea (▶ desde pausa)

1. Encontrá la tarea pausada (tiene borde amarillo)
2. Hacé clic en **"▶ Reanudar"**
3. El contador de tiempo vuelve a correr

### Finalizar una tarea (⏹)

Cuando terminaste completamente:
1. Hacé clic en **"⏹ Finalizar"**
2. Opcionalmente podés escribir un comentario sobre lo que hiciste
3. Hacé clic en **"✅ Finalizar tarea"**
4. El sistema calcula automáticamente cuánto tiempo trabajaste (sin contar las pausas)

---

## AGREGAR TUS PROPIAS TAREAS

Podés agregar tareas que vos mismo necesitás hacer:

1. En el dashboard, buscá el botón **"+ Nueva tarea"**
2. Completá:
   - Nombre de la tarea (elegí de la lista o escribí uno)
   - Cliente (si corresponde)
   - Prioridad (alta/media/baja)
   - Fecha
3. Guardá

> ⚠️ Regla importante: Podés borrar las tareas que VOS creaste. No podés borrar las que te asignó el supervisor.

---

## EL WIDGET DE ESCRITORIO

El widget es más rápido que abrir el navegador. Siempre está visible en tu pantalla.

```
┌─────────────────────────┐
│ TaskFlow Pro  mar 15/01 │
│ 👤 Juan Pérez           │
│ ─────────────────────── │
│ 📋 5/10 completadas hoy │
│ ─────────────────────── │
│ ▌ IVA Cliente ABC       │
│   📁 Impuestos          │
│   [▶ Iniciar]           │
│                         │
│ ▌ Liquidación Sueldos   │
│   📁 Empresa XYZ        │
│   [⏸ Pausar][⏹ Fin]   │
│   ⏱ 1h 23m             │
│ ─────────────────────── │
│ [🔚 Fin de Jornada]     │
│ [🔄 Actualizar]         │
└─────────────────────────┘
```

### Botón "Fin de Jornada"
Al terminar el día:
1. Hacé clic en **"🔚 Fin de Jornada"**
2. El sistema detecta si terminás antes o después de tu horario habitual
3. Si terminás antes: te pide que expliques por qué
4. Si terminás después (horas extra): podés explicar el motivo
5. Las tareas incompletas pasan automáticamente al día siguiente

---

## VER TU HISTORIAL

Podés ver tus tareas de días anteriores:
1. En el dashboard, cambiá la fecha con el selector de fecha
2. Se muestran todas las tareas de ese día con sus estados y tiempos

---

# PARTE 2: PARA SUPERVISORES

> Los supervisores pueden todo lo que un operador más estas funciones adicionales.

## Panel del Supervisor

Ir a **"👥 Panel Supervisor"** en el menú lateral.

### ¿Qué ves?
- Lista de todos tus operadores (izquierda)
- Al hacer clic en un operador: sus tareas del día (derecha)
- Estado en tiempo real de cada tarea
- Cuánto tiempo lleva trabajando en cada una

### Ver tareas de días anteriores
Cambiá la fecha con el selector para ver el historial de cualquier operador.

---

## ASIGNAR TAREAS

### Asignar desde el Dashboard
1. Ir al dashboard
2. Hacer clic en **"+ Nueva tarea"**
3. En el campo **"Asignar a"**, elegí el operador
4. Completá todos los datos
5. Podés escribir instrucciones en **"Comentario para el operador"**

### Asignar para todo el mes
1. Ir al Dashboard
2. Cambiá la vista a **"Mes"**
3. Podés ver y crear tareas para cualquier día del mes
4. Las tareas con reglas automáticas (de servicios) ya aparecen solas

---

## VER LOS REPORTES

Ir a **"📊 Reportes"** en el menú.

### Reporte diario por operador
1. Elegí el operador
2. Elegí la fecha
3. Ves:
   - Hora de inicio de jornada (cuándo empezó la primera tarea)
   - Hora de fin de jornada (cuándo terminó la última)
   - Total de horas en tareas
   - La brecha más larga sin hacer tareas
   - Comparación contra su horario esperado

### Reporte mensual
1. Elegí mes y año
2. Ves el resumen completo del mes:
   - Días trabajados
   - Horas totales
   - Qué día llegó más temprano/tarde
   - Qué día se fue más temprano/tarde

### Reporte por cliente
Muestra cuántas horas se dedicaron a cada cliente en el mes, desglosado por tipo de tarea (impuestos, contabilidad, etc.).

### Reporte por tipo de tarea
Muestra en qué tipos de trabajo se usa más el tiempo, sin importar el cliente.

---

## SEGUIMIENTO DE TAREAS COMPLEJAS

Ir a **"🔍 Seguimiento"** en el menú.

Acá ves las liquidaciones de sueldos, presentaciones sindicales y otras tareas con etapas.

### Semáforo de estados
- 🟢 **Verde**: Todo en orden, completado a tiempo
- 🟡 **Amarillo**: Atención, hay algo que vence hoy
- 🔴 **Rojo**: Vencido o completado tarde (falta)
- ⚪ **Gris**: Pendiente, hay tiempo

### Panel de alertas
Arriba de la pantalla aparece una banda roja con todo lo que necesita atención inmediata. Revisalo TODOS LOS DÍAS al empezar.

---

# PARTE 3: PARA ADMINISTRADORES

## Panel de Administración

Ir a **"⚙️ Administración"** en el menú.

### Pestaña "Empresa"
- Nombre de la empresa (aparece en todos los reportes)
- Horario de jornada por defecto
- Email para notificaciones

### Pestaña "Usuarios"

**Agregar un nuevo usuario:**
1. Hacé clic en **"+ Agregar usuario"**
2. Email de Google: tiene que ser exactamente igual al que usa para Gmail
3. Nombre y apellido
4. Perfiles: elegí uno o más
5. Guardar
6. El usuario ya puede entrar con su Google

**Desactivar un usuario:**
Si alguien deja la empresa, hacé clic en "Desactivar". No se borran sus tareas históricas.

**Los perfiles disponibles:**
- **Operador**: Ve solo sus tareas, puede iniciar/pausar/finalizar
- **Supervisor**: Ve sus operadores, asigna tareas, ve reportes de su equipo
- **Dueño**: Ve todo el sistema, reportes globales
- **Administrador**: Acceso completo incluyendo configuración del sistema

> Un usuario puede tener más de un perfil. Ej: alguien puede ser Dueño Y Administrador al mismo tiempo.

### Pestaña "Feriados"

Los feriados de 2025 ya están cargados. Podés agregar:
- Feriados nacionales de 2026
- Feriados locales específicos de tu ciudad
- Días no laborables de la empresa (ej: cierre por vacaciones)

El sistema usa estos feriados para todos los cálculos de "días hábiles".

### Pestaña "Catálogo de tareas"

Lista de todas las tareas disponibles en el sistema. Las predefinidas ya están cargadas. Podés agregar nuevas desde aquí.

---

## GLOSARIO — ¿Qué significa cada término?

| Término | Definición en palabras simples |
|---|---|
| **Tarea** | Un trabajo específico que hay que hacer. Ej: "Declaración IVA de Empresa ABC" |
| **Tarea heredada** | Una tarea que no se completó ayer y pasó automáticamente a hoy |
| **Rubro** | El tipo de trabajo: Impuestos, Contabilidad, Auditoría, Sueldos, Sindicatos |
| **Servicio/Procedimiento** | Un paquete de tareas que se hacen juntas para un cliente. Ej: "Liquidación mensual de sueldos" |
| **Cliente** | Una empresa o persona a quien le damos servicio |
| **Perfil** | El "rol" del usuario en el sistema (Operador, Supervisor, Dueño, Administrador) |
| **Seguimiento complejo** | Control especial para tareas con etapas y fechas límite estrictas |
| **Día hábil** | Lunes a viernes que no sea feriado |
| **Brecha** | Un período de tiempo sin tareas registradas |
| **Jornada** | El horario de trabajo (ej: de 9:00 a 18:00) |
| **Tiempo trabajado** | El tiempo real en la tarea, SIN contar las pausas |
| **Timestamp** | La fecha y hora exacta en que ocurrió algo |
| **Alta lógica** | Dar de alta a algo (activarlo) |
| **Baja lógica** | Dar de baja (desactivarlo) sin borrar la historia |

---

## PREGUNTAS FRECUENTES DE USUARIOS

**P: Olvidé hacer clic en "Iniciar" antes de empezar a trabajar. ¿Qué hago?**
R: Iniciá la tarea cuando te acordás y avisale a tu supervisor. En una versión futura habrá opción de corregir el horario de inicio.

**P: Hice clic en "Finalizar" sin querer. ¿Puedo revertirlo?**
R: No directamente. Avisale al supervisor para que corrija el estado de la tarea.

**P: ¿Mi supervisor puede ver en tiempo real qué estoy haciendo?**
R: Sí. Desde el Panel Supervisor puede ver el estado de todas tus tareas en cualquier momento.

**P: ¿Puedo usar el sistema desde mi celular?**
R: La web funciona en el navegador del celular, aunque no está optimizada para pantallas muy pequeñas. El widget solo está disponible para Windows.

**P: ¿Qué pasa si no tengo internet?**
R: El sistema necesita conexión. El widget guarda localmente por 5 minutos y sincroniza cuando se restaura la conexión.

**P: ¿Quién puede ver mis reportes?**
R: Tu supervisor directo, el dueño y el administrador. Tus compañeros operadores no pueden ver tus tareas.

---

*Manual de Usuario — TaskFlow Pro v1.0*
*Para soporte técnico, contactar al administrador del sistema*
