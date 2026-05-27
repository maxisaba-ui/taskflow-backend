# GLOSARIO TÉCNICO — TaskFlow Pro
## Términos del sistema explicados en lenguaje simple

---

## TÉRMINOS DEL NEGOCIO

| Término | Definición |
|---|---|
| **Alta lógica** | Activar un registro en el sistema (opuesto a borrarlo) |
| **Baja lógica** | Desactivar un registro sin borrarlo físicamente. La historia queda guardada |
| **Brecha** | Período de tiempo entre tareas sin actividad registrada |
| **Catálogo de tareas** | Lista maestra de todos los tipos de tarea posibles en el sistema |
| **Cierre de jornada** | Acción del operador al finalizar su día de trabajo |
| **Cliente** | Empresa o persona a la que el estudio brinda servicios |
| **Día hábil** | Lunes a viernes que no sea feriado nacional, local o de empresa |
| **Estado semáforo** | Sistema de colores (verde/amarillo/rojo) para visualizar urgencia |
| **Etapa** | Paso dentro de un procedimiento complejo (ej: Recepción → Liquidación → Revisión) |
| **Gantt inverso** | Cálculo de fechas hacia atrás desde una fecha de vencimiento |
| **Herencia de tareas** | Proceso automático que pasa tareas incompletas al día siguiente |
| **Jornada** | Horario laboral de un empleado (inicio y fin) |
| **Lista blanca** | Lista de emails autorizados a entrar al sistema |
| **Período** | Mes y año de referencia (formato YYYY-MM, ej: 2025-05) |
| **Perfil** | Rol del usuario: operador, supervisor, dueño o administrador |
| **Procedimiento** | Conjunto de tareas ordenadas para prestar un servicio |
| **Rubro** | Categoría de tarea: Impuestos, Contabilidad, Auditoría, Sueldos, etc. |
| **Seguimiento complejo** | Control especial para tareas con múltiples etapas y plazos |
| **Servicio** | Tipo de trabajo que ofrece el estudio a sus clientes |
| **Timestamp** | Fecha y hora exacta con zona horaria de un evento |

---

## ESTADOS DE UNA TAREA

| Estado | Ícono | Qué significa |
|---|---|---|
| `pendiente` | ⚪ | Creada pero no iniciada |
| `en_curso` | 🟢 | El operador presionó PLAY |
| `pausada` | 🟡 | Interrumpida temporalmente (con motivo registrado) |
| `completada` | 🔵 | Finalizada exitosamente |
| `vencida` | 🔴 | Pasó la fecha sin completarse |
| `cancelada` | ⬛ | Dada de baja por supervisor |

---

## ESTADOS DE UNA ETAPA DE SEGUIMIENTO

| Estado | Color | Qué significa |
|---|---|---|
| `pendiente` | ⚪ Gris | Todavía hay tiempo |
| `en_curso` | 🔵 Azul | Actualmente en proceso |
| `advertencia_hoy` | 🟡 Amarillo | Vence HOY — atención inmediata |
| `completada_ok` | 🟢 Verde | Completada dentro del plazo |
| `completada_tarde` | 🔴 Rojo | Completada pero fuera de plazo (falta) |
| `vencida` | 🔴 Rojo oscuro | Plazo vencido y sin completar |

---

## TIPOS DE REGLA DE CALENDARIZACIÓN

| Tipo | Ejemplo | Cuándo genera la tarea |
|---|---|---|
| `fecha_fija_mes` | Día 10 del mes | Siempre el día 10 de cada mes |
| `dia_habil` | 5° día hábil | El quinto día hábil de cada mes |
| `dias_despues_etapa_anterior` | 1 día hábil después | Cuando se completa la etapa previa |
| `dias_antes_vencimiento` | 3 días hábiles antes | Se calcula retrocediendo desde el vencimiento |
| `manual` | — | Solo aparece cuando alguien la crea manualmente |

---

## TIPOS DE CREACIÓN DE TAREA

| Tipo | Quién la creó | Puede borrarla el operador? |
|---|---|---|
| `supervisor` | Un supervisor la asignó | ❌ No |
| `operador` | El propio operador la agregó | ✅ Sí |
| `automatica` | El sistema la heredó del día anterior | ❌ No (eliminar la original) |

---

## PERFILES Y PERMISOS RESUMIDOS

|  | Operador | Supervisor | Dueño | Admin |
|---|---|---|---|---|
| Ver sus tareas | ✅ | ✅ | ✅ | ✅ |
| Play/Pausa/Fin | ✅ | ✅ | ✅ | ✅ |
| Agregar tareas propias | ✅ | ✅ | ✅ | ✅ |
| Ver tareas de otros | ❌ | ✅ (sus operadores) | ✅ (todos) | ✅ |
| Asignar tareas a otros | ❌ | ✅ | ✅ | ✅ |
| Ver reportes de equipo | ❌ | ✅ | ✅ | ✅ |
| Ver reportes globales | ❌ | ❌ | ✅ | ✅ |
| Configurar empresa | ❌ | ❌ | ❌ | ✅ |
| Gestionar usuarios | ❌ | ❌ | ❌ | ✅ |
| Cargar feriados | ❌ | ❌ | ❌ | ✅ |
| Gestionar catálogo | ❌ | ❌ | ❌ | ✅ |

---

## TÉRMINOS TÉCNICOS (para el administrador)

| Término | Definición |
|---|---|
| **API** | Interfaz que permite que el frontend y el widget se comuniquen con el backend |
| **Backend** | El "servidor" — el programa que procesa la lógica y guarda datos |
| **Base de datos** | Donde se almacenan permanentemente todos los datos del sistema |
| **Cookie / Token JWT** | "Llave" digital que identifica a un usuario autenticado |
| **CORS** | Configuración que permite al frontend llamar al backend desde otro dominio |
| **Endpoint** | Una URL específica de la API que realiza una acción (ej: /api/v1/tareas/) |
| **Frontend** | La pantalla web que ven los usuarios en el navegador |
| **Google OAuth** | Sistema de Google para iniciar sesión con tu cuenta de Gmail |
| **Job nocturno** | Programa que se ejecuta automáticamente a las 23:59 cada día |
| **ORM** | Capa de software que traduce código Python a consultas SQL |
| **PostgreSQL** | Motor de base de datos relacional usado por el sistema |
| **Railway** | Servicio en la nube donde corre el backend (gratuito) |
| **React** | Librería JavaScript para construir la interfaz web |
| **Supabase** | Servicio en la nube donde vive la base de datos PostgreSQL (gratuito) |
| **Variable de entorno** | Configuración sensible (contraseñas, URLs) que no se guarda en el código |
| **Vercel** | Servicio en la nube donde se aloja el frontend (gratuito) |
| **Widget** | Programita pequeño que se instala en la PC con Windows |

---

## ESTRUCTURA DE URLS DE LA API

Todas las URLs empiezan con `/api/v1/`:

| URL | Método | Qué hace |
|---|---|---|
| `/auth/google` | POST | Login con Google |
| `/auth/me` | GET | Datos del usuario actual |
| `/tareas/` | GET | Listar tareas (con filtros) |
| `/tareas/` | POST | Crear tarea |
| `/tareas/{id}/iniciar` | POST | Presionar PLAY |
| `/tareas/{id}/pausar` | POST | Presionar PAUSA |
| `/tareas/{id}/reanudar` | POST | Reanudar desde pausa |
| `/tareas/{id}/finalizar` | POST | Presionar STOP |
| `/clientes/` | GET | Listar clientes |
| `/reportes/diario/{id}` | GET | Reporte diario de un operador |
| `/reportes/mensual/{id}` | GET | Reporte mensual de un operador |
| `/reportes/por-cliente` | GET | Tiempo por cliente |
| `/reportes/por-rubro` | GET | Tiempo por tipo de tarea |
| `/seguimiento/` | GET | Listar seguimientos con semáforos |
| `/seguimiento/alertas-hoy` | GET | Alertas del día |
| `/parametros/empresa` | GET/PUT | Configuración de la empresa |
| `/parametros/feriados` | GET/POST | Gestión de feriados |
| `/parametros/catalogo` | GET/POST | Catálogo de tareas |

---

*Glosario TaskFlow Pro v1.0*
