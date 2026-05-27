# DER — Diagrama Entidad-Relación — TaskFlow Pro
## Documento de arquitectura de base de datos

---

## DIAGRAMA ENTIDAD-RELACIÓN (simplificado)

```
┌─────────────────┐         ┌─────────────────┐
│    EMPRESAS     │         │    USUARIOS     │
│─────────────────│         │─────────────────│
│ id (PK)         │         │ id (PK)         │
│ nombre          │         │ google_id       │
│ logo_url        │         │ email (UNIQUE)  │
│ horario_inicio  │         │ nombre          │
│ horario_fin     │         │ apellido        │
│ zona_horaria    │         │ foto_url        │
└─────────────────┘         │ horario_inicio  │◄──── Puede sobrescribir
                            │ horario_fin     │      el default de empresa
                            │ activo          │
                            │ fecha_alta      │
                            │ fecha_baja      │
                            └────────┬────────┘
                                     │
              ┌──────────────────────┼────────────────────────┐
              │                      │                        │
              ▼                      ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  USUARIO_PERFILES   │  │ SUPERVISOR_OPERADOR  │  │      SESIONES       │
│─────────────────────│  │─────────────────────│  │─────────────────────│
│ id (PK)             │  │ id (PK)             │  │ id (PK)             │
│ usuario_id (FK)     │  │ supervisor_id (FK)  │  │ usuario_id (FK)     │
│ perfil_id (FK)      │  │ operador_id (FK)    │  │ token_hash          │
│ activo              │  │ activo              │  │ activa              │
│ fecha_alta          │  │ fecha_inicio        │  │ expira_en           │
│ fecha_baja          │  │ fecha_fin           │  └─────────────────────┘
└──────────┬──────────┘  └─────────────────────┘
           │
           ▼
┌─────────────────┐
│    PERFILES     │
│─────────────────│
│ id (PK)         │
│ codigo (UNIQUE) │  ← 'operador','supervisor','dueno','administrador'
│ nombre          │
│ descripcion     │
│ activo          │
└─────────────────┘


┌─────────────────┐         ┌─────────────────────┐
│    CLIENTES     │─────────│  CLIENTE_SERVICIOS  │
│─────────────────│  1:N    │─────────────────────│
│ id (PK)         │         │ id (PK)             │
│ razon_social    │         │ cliente_id (FK)     │
│ cuit            │         │ servicio_id (FK)    │
│ email           │         │ activo              │
│ telefono        │         │ fecha_inicio        │
│ responsable_id  │(FK→user)│ fecha_fin           │
│ activo          │         └──────────┬──────────┘
│ fecha_alta      │                    │
│ fecha_baja      │                    ▼
└────────┬────────┘         ┌─────────────────────┐
         │                  │      SERVICIOS      │
         │                  │─────────────────────│
         │                  │ id (PK)             │
         │                  │ codigo (UNIQUE)     │
         │                  │ nombre              │
         │                  │ rubro_id (FK)       │
         │                  │ tipo_calendarizacion│
         │                  │ activo              │
         │                  └──────────┬──────────┘
         │                             │ 1:N
         │                             ▼
         │                  ┌─────────────────────────┐
         │                  │    SERVICIO_TAREAS      │
         │                  │─────────────────────────│
         │                  │ id (PK)                 │
         │                  │ servicio_id (FK)        │
         │                  │ catalogo_tarea_id (FK)  │
         │                  │ orden                   │
         │                  │ es_obligatoria          │
         │                  │ tipo_regla              │
         │                  │ dia_del_mes             │
         │                  │ numero_dia_habil        │
         │                  │ dias_habiles_despues    │
         │                  │ dias_habiles_antes      │
         │                  │ limite_horas_habiles    │
         │                  └─────────────────────────┘


┌─────────────────────┐
│   CATALOGO_TAREAS   │
│─────────────────────│
│ id (PK)             │
│ codigo (UNIQUE)     │
│ nombre              │
│ descripcion         │
│ rubro_id (FK)       │────────► RUBROS_TAREA
│ duracion_estimada   │          (impuestos, contabilidad...)
│ requiere_cliente    │
│ es_compleja         │
│ activo              │
└──────────┬──────────┘
           │ 1:N
           ▼
┌─────────────────────────────────────────────────────┐
│                       TAREAS                        │
│─────────────────────────────────────────────────────│
│ id (PK)                                             │
│ catalogo_tarea_id (FK) ──► CATALOGO_TAREAS          │
│ nombre_personalizado    ← si no viene del catálogo  │
│ rubro_id (FK) ──────────► RUBROS_TAREA              │
│ asignado_a_id (FK) ─────► USUARIOS                  │
│ cliente_id (FK) ────────► CLIENTES (opcional)       │
│ servicio_id (FK) ───────► SERVICIOS (opcional)      │
│ fecha_planificada                                   │
│ fecha_vencimiento                                   │
│ prioridad           ← 'alta','media','baja'         │
│ estado              ← 'pendiente','en_curso',etc.   │
│ inicio_real         ← se llena al hacer PLAY        │
│ fin_real            ← se llena al hacer STOP        │
│ tiempo_trabajado_minutos ← calculado auto           │
│ heredada_de_id (FK) ────► TAREAS (auto-referencia)  │
│ es_heredada                                         │
│ creada_por_id (FK) ─────► USUARIOS                  │
│ tipo_creacion       ← 'supervisor','operador','auto'│
│ comentario_supervisor                               │
│ comentario_operador                                 │
│ es_tarea_compleja                                   │
│ seguimiento_complejo_id (FK)                        │
│ activa                                              │
│ creado_en                                           │
│ actualizado_en                                      │
└─────────────┬──────────────────────────────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
    ▼                    ▼
┌───────────────┐  ┌──────────────────┐
│ TAREA_PAUSAS  │  │TAREA_COMENTARIOS │
│───────────────│  │──────────────────│
│ id (PK)       │  │ id (PK)          │
│ tarea_id (FK) │  │ tarea_id (FK)    │
│ inicio_pausa  │  │ usuario_id (FK)  │
│ fin_pausa     │  │ tipo             │
│ motivo        │  │ comentario       │
│ duracion_min  │  │ creado_en        │
└───────────────┘  └──────────────────┘


┌─────────────────────────────────────┐
│        SEGUIMIENTO_COMPLEJO         │
│─────────────────────────────────────│
│ id (PK)                             │
│ nombre                              │
│ cliente_id (FK) ──────► CLIENTES    │
│ servicio_id (FK) ─────► SERVICIOS   │
│ responsable_id (FK) ──► USUARIOS    │
│ periodo         ← 'YYYY-MM'         │
│ tipo            ← 'hacia_adelante'  │
│                    'hacia_atras'    │
│ fecha_vencimiento ← para Gantt inv. │
│ estado                              │
│ fecha_inicio_real                   │
│ fecha_fin_real                      │
└──────────────┬──────────────────────┘
               │ 1:N
               ▼
┌─────────────────────────────────────┐
│        SEGUIMIENTO_ETAPAS           │
│─────────────────────────────────────│
│ id (PK)                             │
│ seguimiento_id (FK)                 │
│ orden                               │
│ nombre                              │
│ es_obligatoria                      │
│ tipo_limite                         │
│ limite_cantidad ← horas o días      │
│ fecha_limite_calculada              │
│ estado                              │
│ completada_en                       │
│ completada_por (FK) ──► USUARIOS    │
│ es_actualizacion ← para reliquid.  │
│ etapa_original_id (FK → self)       │
└─────────────────────────────────────┘


┌─────────────────┐    ┌─────────────────────┐
│    FERIADOS     │    │    CIERRES_DIA      │
│─────────────────│    │─────────────────────│
│ id (PK)         │    │ id (PK)             │
│ fecha (UNIQUE)  │    │ usuario_id (FK)     │
│ nombre          │    │ fecha               │
│ tipo            │    │ hora_cierre         │
│ anio            │    │ tipo_cierre         │
│ activo          │    │ comentario          │
└─────────────────┘    │ primera_tarea_hora  │
                       │ ultima_tarea_hora   │
┌─────────────────┐    │ horas_en_tareas     │
│  AUDITORIA_LOG  │    │ horas_sin_tareas    │
│─────────────────│    │ brecha_max_minutos  │
│ id (PK)         │    │ tareas_completadas  │
│ tabla_afectada  │    │ tareas_pendientes   │
│ registro_id     │    └─────────────────────┘
│ operacion       │
│ campo_modif.    │    ┌─────────────────────┐
│ valor_anterior  │    │  NOTIFICACIONES     │
│ valor_nuevo     │    │─────────────────────│
│ usuario_id (FK) │    │ id (PK)             │
│ ip_address      │    │ usuario_id (FK)     │
│ timestamp       │    │ tipo                │
└─────────────────┘    │ titulo              │
                       │ mensaje             │
                       │ leida               │
                       └─────────────────────┘
```

---

## CARDINALIDADES CLAVE

| Relación | Cardinalidad | Explicación |
|---|---|---|
| Usuario → Perfiles | N:M | Un usuario puede tener varios perfiles |
| Supervisor → Operador | N:M | Un supervisor tiene varios operadores y viceversa |
| Cliente → Servicios | N:M | Un cliente puede tener varios servicios |
| Servicio → Tareas catálogo | N:M | Un servicio tiene varias tareas del catálogo |
| Tarea → Pausas | 1:N | Una tarea puede tener varias pausas |
| Tarea → Comentarios | 1:N | Una tarea puede tener varios comentarios |
| Tarea → Tarea (herencia) | 1:N | Una tarea puede generar copias en días futuros |
| SeguimientoComplejo → Etapas | 1:N | Un seguimiento tiene varias etapas ordenadas |

---

## ÍNDICES PARA RENDIMIENTO

Los índices más importantes (el sistema los crea automáticamente):

- `tareas (asignado_a_id, fecha_planificada)` — Para cargar las tareas del día de un usuario
- `tareas (fecha_planificada, estado)` — Para filtros por fecha y estado
- `tareas (cliente_id)` — Para reportes por cliente
- `auditoria_log (tabla_afectada, registro_id)` — Para ver el historial de cambios de un registro
- `sesiones (token_hash)` — Para validar tokens rápidamente
- `cierres_dia (usuario_id, fecha)` — Para métricas diarias

---

## REGLAS DE INTEGRIDAD

1. **No se borran datos**: Todo usa `activo = FALSE` para "borrar" en lugar de `DELETE`
2. **Timestamps obligatorios**: Toda tabla tiene `creado_en` con zona horaria
3. **Auditoría automática**: Los cambios en tablas clave se registran en `auditoria_log`
4. **Usuario no puede ser su propio supervisor**: `CHECK (supervisor_id != operador_id)`
5. **Email único**: Dos usuarios no pueden tener el mismo email
6. **Tarea necesita nombre**: O `catalogo_tarea_id` o `nombre_personalizado` (validado en el backend)

---

*Documento de arquitectura — TaskFlow Pro v1.0*
