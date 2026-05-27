-- ============================================================
-- TaskFlow Pro — Script de creación de base de datos
-- Motor: PostgreSQL 15+
-- Plataforma: Supabase (gratuito)
-- Fecha: 2025
-- ============================================================
-- INSTRUCCIONES:
-- 1. Crear cuenta en https://supabase.com
-- 2. Crear proyecto nuevo
-- 3. Ir a "SQL Editor"
-- 4. Pegar todo este script y ejecutar
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsqueda de texto

-- ============================================================
-- TABLA: empresas (configuración general del sistema)
-- ============================================================
CREATE TABLE empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(200) NOT NULL,
    logo_url TEXT,
    icono_url TEXT,
    zona_horaria VARCHAR(50) DEFAULT 'America/Argentina/Buenos_Aires',
    formato_fecha VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    horario_inicio_default TIME DEFAULT '09:00:00',
    horario_fin_default TIME DEFAULT '18:00:00',
    email_notificaciones VARCHAR(200),
    smtp_host VARCHAR(200),
    smtp_puerto INTEGER DEFAULT 587,
    smtp_usuario VARCHAR(200),
    smtp_password_enc TEXT,
    activa BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar empresa por defecto
INSERT INTO empresas (nombre) VALUES ('Mi Estudio Contable');

-- ============================================================
-- TABLA: usuarios
-- ============================================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id VARCHAR(100) UNIQUE,
    email VARCHAR(200) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    foto_url TEXT,
    horario_inicio TIME,           -- NULL = usa el default del sistema
    horario_fin TIME,              -- NULL = usa el default del sistema
    activo BOOLEAN DEFAULT TRUE,
    fecha_alta DATE DEFAULT CURRENT_DATE,
    fecha_baja DATE,
    ultimo_login TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    creado_por UUID REFERENCES usuarios(id)
);

-- ============================================================
-- TABLA: perfiles (roles del sistema)
-- ============================================================
CREATE TABLE perfiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) NOT NULL UNIQUE,  -- 'operador', 'supervisor', 'dueno', 'administrador'
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE
);

INSERT INTO perfiles (codigo, nombre, descripcion) VALUES
    ('operador', 'Operador', 'Usuario que ejecuta tareas asignadas'),
    ('supervisor', 'Supervisor', 'Asigna y supervisa tareas de operadores'),
    ('dueno', 'Dueño', 'Acceso a métricas y reportes globales'),
    ('administrador', 'Administrador', 'Configuración completa del sistema');

-- ============================================================
-- TABLA: usuario_perfiles (un usuario puede tener varios perfiles)
-- ============================================================
CREATE TABLE usuario_perfiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    perfil_id UUID NOT NULL REFERENCES perfiles(id),
    activo BOOLEAN DEFAULT TRUE,
    fecha_alta DATE DEFAULT CURRENT_DATE,
    fecha_baja DATE,
    asignado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, perfil_id)
);

-- ============================================================
-- TABLA: supervisor_operador (quién supervisa a quién)
-- ============================================================
CREATE TABLE supervisor_operador (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supervisor_id UUID NOT NULL REFERENCES usuarios(id),
    operador_id UUID NOT NULL REFERENCES usuarios(id),
    activo BOOLEAN DEFAULT TRUE,
    fecha_inicio DATE DEFAULT CURRENT_DATE,
    fecha_fin DATE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supervisor_id, operador_id),
    CHECK (supervisor_id != operador_id)
);

-- ============================================================
-- TABLA: feriados
-- ============================================================
CREATE TABLE feriados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'nacional',  -- 'nacional', 'local', 'empresa'
    anio INTEGER NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    creado_por UUID REFERENCES usuarios(id),
    UNIQUE(fecha)
);

-- ============================================================
-- TABLA: rubros_tarea (impuestos, contabilidad, etc.)
-- ============================================================
CREATE TABLE rubros_tarea (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    color_hex VARCHAR(7) DEFAULT '#6366f1',
    icono VARCHAR(50),
    orden INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    fecha_alta DATE DEFAULT CURRENT_DATE,
    fecha_baja DATE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO rubros_tarea (codigo, nombre, color_hex) VALUES
    ('impuestos', 'Impuestos', '#ef4444'),
    ('contabilidad', 'Contabilidad', '#3b82f6'),
    ('auditoria', 'Auditoría', '#8b5cf6'),
    ('sueldos', 'Liquidación de Sueldos', '#f59e0b'),
    ('sindicatos', 'Sindicatos / SICOS', '#10b981'),
    ('general', 'General / Administrativo', '#6b7280');

-- ============================================================
-- TABLA: catalogo_tareas (lista de todas las tareas posibles)
-- ============================================================
CREATE TABLE catalogo_tareas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(100) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    rubro_id UUID NOT NULL REFERENCES rubros_tarea(id),
    duracion_estimada_minutos INTEGER,  -- estimación de cuánto lleva
    requiere_cliente BOOLEAN DEFAULT TRUE,
    es_compleja BOOLEAN DEFAULT FALSE,  -- tiene seguimiento especial
    activo BOOLEAN DEFAULT TRUE,
    fecha_alta DATE DEFAULT CURRENT_DATE,
    fecha_baja DATE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    creado_por UUID REFERENCES usuarios(id)
);

-- ============================================================
-- TABLA: clientes
-- ============================================================
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razon_social VARCHAR(200) NOT NULL,
    cuit VARCHAR(20),
    email VARCHAR(200),
    telefono VARCHAR(50),
    celular VARCHAR(50),
    direccion TEXT,
    localidad VARCHAR(100),
    provincia VARCHAR(100) DEFAULT 'Buenos Aires',
    responsable_interno_id UUID REFERENCES usuarios(id),
    notas TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_alta DATE DEFAULT CURRENT_DATE,
    fecha_baja DATE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    creado_por UUID REFERENCES usuarios(id),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: servicios (procedimientos que ofrece el estudio)
-- ============================================================
CREATE TABLE servicios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(100) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    rubro_id UUID REFERENCES rubros_tarea(id),
    tipo_calendarizacion VARCHAR(50) DEFAULT 'manual',
    -- 'manual', 'fecha_fija', 'dia_habil', 'desde_vencimiento'
    activo BOOLEAN DEFAULT TRUE,
    fecha_alta DATE DEFAULT CURRENT_DATE,
    fecha_baja DATE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    creado_por UUID REFERENCES usuarios(id)
);

-- ============================================================
-- TABLA: servicio_tareas (qué tareas componen cada servicio)
-- ============================================================
CREATE TABLE servicio_tareas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    servicio_id UUID NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
    catalogo_tarea_id UUID NOT NULL REFERENCES catalogo_tareas(id),
    orden INTEGER NOT NULL DEFAULT 1,
    es_obligatoria BOOLEAN DEFAULT TRUE,
    
    -- REGLA DE CUÁNDO APARECE ESTA TAREA
    tipo_regla VARCHAR(50),
    -- 'fecha_fija_mes': dia_del_mes
    -- 'dia_habil': numero_dia_habil
    -- 'dias_despues_etapa_anterior': dias_habiles_despues
    -- 'dias_antes_vencimiento': dias_habiles_antes
    -- 'manual': aparece solo cuando la dispara alguien
    
    dia_del_mes INTEGER,           -- Para tipo 'fecha_fija_mes' (1-31)
    numero_dia_habil INTEGER,      -- Para tipo 'dia_habil' (1=primer día hábil)
    dias_habiles_despues INTEGER,  -- Para 'dias_despues_etapa_anterior'
    dias_habiles_antes INTEGER,    -- Para 'dias_antes_vencimiento'
    
    -- Para seguimiento complejo
    limite_horas_habiles INTEGER,  -- Límite en horas hábiles para completar
    
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: cliente_servicios (qué servicios tiene cada cliente)
-- ============================================================
CREATE TABLE cliente_servicios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    servicio_id UUID NOT NULL REFERENCES servicios(id),
    activo BOOLEAN DEFAULT TRUE,
    fecha_inicio DATE DEFAULT CURRENT_DATE,
    fecha_fin DATE,
    notas TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    creado_por UUID REFERENCES usuarios(id),
    UNIQUE(cliente_id, servicio_id)
);

-- ============================================================
-- TABLA: tareas (el corazón del sistema)
-- ============================================================
CREATE TABLE tareas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Qué tarea es
    catalogo_tarea_id UUID REFERENCES catalogo_tareas(id),
    nombre_personalizado VARCHAR(200),  -- Si no viene del catálogo
    descripcion TEXT,
    rubro_id UUID REFERENCES rubros_tarea(id),
    
    -- A quién y para qué
    asignado_a_id UUID NOT NULL REFERENCES usuarios(id),
    cliente_id UUID REFERENCES clientes(id),
    servicio_id UUID REFERENCES servicios(id),
    
    -- Cuándo
    fecha_planificada DATE NOT NULL,
    fecha_vencimiento DATE,
    prioridad VARCHAR(20) DEFAULT 'media',  -- 'alta', 'media', 'baja'
    
    -- Estado
    estado VARCHAR(30) DEFAULT 'pendiente',
    -- 'pendiente', 'en_curso', 'pausada', 'completada', 'vencida', 'cancelada'
    
    -- Control de tiempo (se llenan cuando el operador interactúa)
    inicio_real TIMESTAMPTZ,
    fin_real TIMESTAMPTZ,
    tiempo_trabajado_minutos INTEGER DEFAULT 0,  -- Acumulado (considera pausas)
    
    -- Herencia
    heredada_de_id UUID REFERENCES tareas(id),  -- ID de la tarea del día anterior
    es_heredada BOOLEAN DEFAULT FALSE,
    
    -- Quién la creó
    creada_por_id UUID NOT NULL REFERENCES usuarios(id),
    tipo_creacion VARCHAR(30) DEFAULT 'supervisor',  -- 'supervisor', 'operador', 'automatica'
    
    -- Comentarios
    comentario_supervisor TEXT,
    comentario_operador TEXT,
    
    -- Para seguimiento complejo
    es_tarea_compleja BOOLEAN DEFAULT FALSE,
    seguimiento_complejo_id UUID,  -- FK a la tabla de seguimiento complejo
    
    -- Auditoría
    activa BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_por UUID REFERENCES usuarios(id)
);

-- ============================================================
-- TABLA: tarea_pausas (cada vez que se pausa una tarea)
-- ============================================================
CREATE TABLE tarea_pausas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tarea_id UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    inicio_pausa TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fin_pausa TIMESTAMPTZ,
    motivo TEXT NOT NULL,
    duracion_minutos INTEGER,  -- Se calcula al reanudar
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: tarea_comentarios (historial de comentarios)
-- ============================================================
CREATE TABLE tarea_comentarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tarea_id UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tipo VARCHAR(30) DEFAULT 'general',  -- 'supervisor', 'operador', 'sistema'
    comentario TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: seguimiento_complejo (para liquidaciones, sindicatos, etc.)
-- ============================================================
CREATE TABLE seguimiento_complejo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Contexto
    nombre VARCHAR(200) NOT NULL,
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    servicio_id UUID NOT NULL REFERENCES servicios(id),
    responsable_id UUID NOT NULL REFERENCES usuarios(id),
    periodo VARCHAR(20) NOT NULL,  -- 'YYYY-MM' para mes/año
    
    -- Tipo de seguimiento
    tipo VARCHAR(30) NOT NULL,  -- 'hacia_adelante', 'hacia_atras'
    
    -- Para tipo 'hacia_atras': la fecha de vencimiento final
    fecha_vencimiento DATE,
    
    -- Estado general
    estado VARCHAR(30) DEFAULT 'pendiente',
    -- 'pendiente', 'en_curso', 'completado', 'con_falta', 'cancelado'
    
    -- Fechas reales
    fecha_inicio_real TIMESTAMPTZ,
    fecha_fin_real TIMESTAMPTZ,
    
    notas TEXT,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    creado_por UUID REFERENCES usuarios(id),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: seguimiento_etapas (etapas dentro de un seguimiento complejo)
-- ============================================================
CREATE TABLE seguimiento_etapas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seguimiento_id UUID NOT NULL REFERENCES seguimiento_complejo(id) ON DELETE CASCADE,
    
    -- Definición de la etapa
    orden INTEGER NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    es_obligatoria BOOLEAN DEFAULT TRUE,
    
    -- Regla de fecha límite
    tipo_limite VARCHAR(50),
    -- 'horas_habiles_despues_inicio_seguimiento'
    -- 'horas_habiles_despues_etapa_anterior'
    -- 'dias_habiles_antes_vencimiento'
    limite_cantidad INTEGER,  -- Cantidad de horas o días
    
    -- Fecha límite calculada
    fecha_limite_calculada TIMESTAMPTZ,
    
    -- Estado de esta etapa
    estado VARCHAR(30) DEFAULT 'pendiente',
    -- 'pendiente', 'en_curso', 'completada_ok', 'completada_tarde', 'vencida'
    
    -- Cuándo se completó realmente
    completada_en TIMESTAMPTZ,
    completada_por UUID REFERENCES usuarios(id),
    
    -- Si hubo actualización (reliquidación), apunta a la etapa que la originó
    es_actualizacion BOOLEAN DEFAULT FALSE,
    etapa_original_id UUID REFERENCES seguimiento_etapas(id),
    
    notas TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: cierres_dia (registro del fin de jornada)
-- ============================================================
CREATE TABLE cierres_dia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    fecha DATE NOT NULL,
    hora_cierre TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    comentario TEXT,
    tipo_cierre VARCHAR(30) DEFAULT 'normal',
    -- 'normal', 'anticipado', 'horas_extra'
    motivo_anticipado TEXT,
    horas_extra_autorizadas BOOLEAN,
    motivo_horas_extra TEXT,
    
    -- Métricas calculadas al cierre
    primera_tarea_hora TIMESTAMPTZ,
    ultima_tarea_hora TIMESTAMPTZ,
    horas_en_tareas DECIMAL(5,2),
    horas_sin_tareas DECIMAL(5,2),
    brecha_mas_larga_minutos INTEGER,
    total_tareas INTEGER,
    tareas_completadas INTEGER,
    tareas_pendientes INTEGER,
    
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, fecha)
);

-- ============================================================
-- TABLA: auditoria_log (registro de todos los cambios)
-- ============================================================
CREATE TABLE auditoria_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tabla_afectada VARCHAR(100) NOT NULL,
    registro_id UUID NOT NULL,
    operacion VARCHAR(20) NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
    campo_modificado VARCHAR(100),
    valor_anterior TEXT,
    valor_nuevo TEXT,
    usuario_id UUID REFERENCES usuarios(id),
    ip_address INET,
    user_agent TEXT,
    timestamp_accion TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: sesiones (control de login)
-- ============================================================
CREATE TABLE sesiones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    activa BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    expira_en TIMESTAMPTZ NOT NULL,
    cerrado_en TIMESTAMPTZ
);

-- ============================================================
-- TABLA: notificaciones
-- ============================================================
CREATE TABLE notificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    -- 'tarea_por_vencer', 'tarea_vencida', 'tarea_asignada', 'sistema'
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    leida BOOLEAN DEFAULT FALSE,
    datos_extra JSONB,  -- Datos adicionales en formato JSON
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    leida_en TIMESTAMPTZ
);

-- ============================================================
-- ÍNDICES (para que las consultas sean rápidas)
-- ============================================================
CREATE INDEX idx_tareas_asignado ON tareas(asignado_a_id);
CREATE INDEX idx_tareas_fecha ON tareas(fecha_planificada);
CREATE INDEX idx_tareas_estado ON tareas(estado);
CREATE INDEX idx_tareas_cliente ON tareas(cliente_id);
CREATE INDEX idx_tareas_fecha_estado ON tareas(fecha_planificada, estado);
CREATE INDEX idx_auditoria_tabla ON auditoria_log(tabla_afectada, registro_id);
CREATE INDEX idx_auditoria_usuario ON auditoria_log(usuario_id);
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id, leida);
CREATE INDEX idx_seguimiento_cliente ON seguimiento_complejo(cliente_id, periodo);
CREATE INDEX idx_sesiones_token ON sesiones(token_hash);
CREATE INDEX idx_cierres_usuario_fecha ON cierres_dia(usuario_id, fecha);

-- ============================================================
-- VISTAS (consultas pre-armadas para reportes)
-- ============================================================

-- Vista: Tareas de hoy con información completa
CREATE OR REPLACE VIEW v_tareas_hoy AS
SELECT 
    t.id,
    t.fecha_planificada,
    COALESCE(ct.nombre, t.nombre_personalizado) AS nombre_tarea,
    t.estado,
    t.prioridad,
    t.inicio_real,
    t.fin_real,
    t.tiempo_trabajado_minutos,
    t.es_heredada,
    u.nombre || ' ' || u.apellido AS operador,
    u.id AS operador_id,
    c.razon_social AS cliente,
    c.id AS cliente_id,
    rt.nombre AS rubro,
    rt.color_hex AS rubro_color,
    t.comentario_supervisor,
    t.comentario_operador,
    t.tipo_creacion
FROM tareas t
LEFT JOIN usuarios u ON t.asignado_a_id = u.id
LEFT JOIN clientes c ON t.cliente_id = c.id
LEFT JOIN catalogo_tareas ct ON t.catalogo_tarea_id = ct.id
LEFT JOIN rubros_tarea rt ON t.rubro_id = rt.id
WHERE t.fecha_planificada = CURRENT_DATE
  AND t.activa = TRUE;

-- Vista: Métricas diarias por usuario
CREATE OR REPLACE VIEW v_metricas_diarias AS
SELECT
    t.asignado_a_id AS usuario_id,
    u.nombre || ' ' || u.apellido AS operador,
    t.fecha_planificada AS fecha,
    COUNT(*) AS total_tareas,
    COUNT(*) FILTER (WHERE t.estado = 'completada') AS tareas_completadas,
    COUNT(*) FILTER (WHERE t.estado = 'pendiente') AS tareas_pendientes,
    COUNT(*) FILTER (WHERE t.estado = 'vencida') AS tareas_vencidas,
    SUM(t.tiempo_trabajado_minutos) AS minutos_trabajados,
    MIN(t.inicio_real) AS primera_tarea,
    MAX(t.fin_real) AS ultima_tarea
FROM tareas t
JOIN usuarios u ON t.asignado_a_id = u.id
WHERE t.activa = TRUE
GROUP BY t.asignado_a_id, u.nombre, u.apellido, t.fecha_planificada;

-- Vista: Tiempo por cliente en el mes
CREATE OR REPLACE VIEW v_tiempo_por_cliente_mes AS
SELECT
    DATE_TRUNC('month', t.fecha_planificada) AS mes,
    c.id AS cliente_id,
    c.razon_social AS cliente,
    rt.nombre AS rubro,
    SUM(t.tiempo_trabajado_minutos) AS minutos_totales,
    COUNT(DISTINCT t.asignado_a_id) AS cantidad_operadores,
    COUNT(*) AS cantidad_tareas
FROM tareas t
JOIN clientes c ON t.cliente_id = c.id
JOIN rubros_tarea rt ON t.rubro_id = rt.id
WHERE t.estado = 'completada'
  AND t.activa = TRUE
GROUP BY DATE_TRUNC('month', t.fecha_planificada), c.id, c.razon_social, rt.nombre;

-- ============================================================
-- FUNCIÓN: calcular_dia_habil
-- Dada una fecha y cantidad de días hábiles, devuelve la fecha resultante
-- ============================================================
CREATE OR REPLACE FUNCTION calcular_dia_habil(
    fecha_inicio DATE,
    dias_habiles INTEGER,
    sentido INTEGER DEFAULT 1  -- 1 = hacia adelante, -1 = hacia atrás
) RETURNS DATE AS $$
DECLARE
    fecha_actual DATE := fecha_inicio;
    dias_contados INTEGER := 0;
BEGIN
    WHILE dias_contados < dias_habiles LOOP
        fecha_actual := fecha_actual + sentido;
        -- Verificar que no sea fin de semana
        IF EXTRACT(DOW FROM fecha_actual) NOT IN (0, 6) THEN
            -- Verificar que no sea feriado
            IF NOT EXISTS (
                SELECT 1 FROM feriados 
                WHERE fecha = fecha_actual AND activo = TRUE
            ) THEN
                dias_contados := dias_contados + 1;
            END IF;
        END IF;
    END LOOP;
    RETURN fecha_actual;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCIÓN: heredar_tareas_del_dia
-- Se llama automáticamente al cierre del día (o via job programado)
-- ============================================================
CREATE OR REPLACE FUNCTION heredar_tareas_del_dia(fecha_origen DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
    fecha_destino DATE;
    contador INTEGER := 0;
    tarea_record RECORD;
BEGIN
    -- Calcular el siguiente día hábil
    fecha_destino := calcular_dia_habil(fecha_origen, 1, 1);
    
    -- Seleccionar tareas incompletas del día origen
    FOR tarea_record IN 
        SELECT * FROM tareas 
        WHERE fecha_planificada = fecha_origen
          AND estado IN ('pendiente', 'en_curso', 'pausada')
          AND activa = TRUE
    LOOP
        -- Insertar copia en el día siguiente
        INSERT INTO tareas (
            catalogo_tarea_id,
            nombre_personalizado,
            descripcion,
            rubro_id,
            asignado_a_id,
            cliente_id,
            servicio_id,
            fecha_planificada,
            fecha_vencimiento,
            prioridad,
            estado,
            heredada_de_id,
            es_heredada,
            creada_por_id,
            tipo_creacion,
            comentario_supervisor,
            es_tarea_compleja,
            seguimiento_complejo_id
        ) VALUES (
            tarea_record.catalogo_tarea_id,
            tarea_record.nombre_personalizado,
            tarea_record.descripcion,
            tarea_record.rubro_id,
            tarea_record.asignado_a_id,
            tarea_record.cliente_id,
            tarea_record.servicio_id,
            fecha_destino,
            tarea_record.fecha_vencimiento,
            tarea_record.prioridad,
            'pendiente',
            tarea_record.id,
            TRUE,
            tarea_record.creada_por_id,
            'automatica',
            tarea_record.comentario_supervisor,
            tarea_record.es_tarea_compleja,
            tarea_record.seguimiento_complejo_id
        );
        
        contador := contador + 1;
    END LOOP;
    
    RETURN contador;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCIÓN: calcular_fecha_limite_etapa
-- Calcula la fecha límite de una etapa según su tipo de regla
-- ============================================================
CREATE OR REPLACE FUNCTION calcular_fecha_limite_etapa(
    tipo_limite VARCHAR(50),
    limite_cantidad INTEGER,
    fecha_referencia TIMESTAMPTZ
) RETURNS TIMESTAMPTZ AS $$
DECLARE
    resultado DATE;
BEGIN
    CASE tipo_limite
        WHEN 'horas_habiles_despues_inicio_seguimiento',
             'horas_habiles_despues_etapa_anterior' THEN
            -- Convertimos horas hábiles a días hábiles (aprox 8 horas/día)
            resultado := calcular_dia_habil(
                fecha_referencia::DATE,
                CEIL(limite_cantidad::FLOAT / 8)::INTEGER,
                1
            );
        WHEN 'dias_habiles_antes_vencimiento' THEN
            resultado := calcular_dia_habil(
                fecha_referencia::DATE,
                limite_cantidad,
                -1
            );
        ELSE
            resultado := (fecha_referencia + INTERVAL '1 day')::DATE;
    END CASE;
    
    RETURN resultado::TIMESTAMPTZ + INTERVAL '23:59:59';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER: actualizar timestamps automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_updated
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION trigger_actualizar_timestamp();

CREATE TRIGGER trg_tareas_updated
    BEFORE UPDATE ON tareas
    FOR EACH ROW EXECUTE FUNCTION trigger_actualizar_timestamp();

CREATE TRIGGER trg_clientes_updated
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION trigger_actualizar_timestamp();

CREATE TRIGGER trg_empresas_updated
    BEFORE UPDATE ON empresas
    FOR EACH ROW EXECUTE FUNCTION trigger_actualizar_timestamp();

-- ============================================================
-- DATOS DE EJEMPLO (para pruebas iniciales)
-- ============================================================

-- Insertar feriados nacionales Argentina 2025
INSERT INTO feriados (fecha, nombre, tipo, anio) VALUES
    ('2025-01-01', 'Año Nuevo', 'nacional', 2025),
    ('2025-03-03', 'Carnaval', 'nacional', 2025),
    ('2025-03-04', 'Carnaval', 'nacional', 2025),
    ('2025-03-24', 'Día Nacional de la Memoria', 'nacional', 2025),
    ('2025-04-02', 'Malvinas', 'nacional', 2025),
    ('2025-04-18', 'Viernes Santo', 'nacional', 2025),
    ('2025-05-01', 'Día del Trabajo', 'nacional', 2025),
    ('2025-05-25', 'Revolución de Mayo', 'nacional', 2025),
    ('2025-06-16', 'Güemes', 'nacional', 2025),
    ('2025-06-20', 'Belgrano', 'nacional', 2025),
    ('2025-07-09', 'Independencia', 'nacional', 2025),
    ('2025-08-17', 'San Martín', 'nacional', 2025),
    ('2025-10-13', 'Respeto a la Diversidad Cultural', 'nacional', 2025),
    ('2025-11-20', 'Soberanía Nacional', 'nacional', 2025),
    ('2025-12-08', 'Inmaculada Concepción', 'nacional', 2025),
    ('2025-12-25', 'Navidad', 'nacional', 2025);

-- Insertar tareas del catálogo
INSERT INTO catalogo_tareas (codigo, nombre, rubro_id, duracion_estimada_minutos, requiere_cliente, es_compleja) VALUES
    ('LIQ_SUELDOS', 'Liquidación de Sueldos', 
        (SELECT id FROM rubros_tarea WHERE codigo = 'sueldos'), 120, TRUE, TRUE),
    ('RECEP_NOVEDADES', 'Recepción de Novedades', 
        (SELECT id FROM rubros_tarea WHERE codigo = 'sueldos'), 30, TRUE, FALSE),
    ('REVISION_LIQ', 'Revisión de Liquidación', 
        (SELECT id FROM rubros_tarea WHERE codigo = 'sueldos'), 60, TRUE, FALSE),
    ('ENVIO_CLIENTE', 'Envío al Cliente', 
        (SELECT id FROM rubros_tarea WHERE codigo = 'sueldos'), 20, TRUE, FALSE),
    ('PRES_SINDICAL', 'Presentación Sindical', 
        (SELECT id FROM rubros_tarea WHERE codigo = 'sindicatos'), 90, TRUE, TRUE),
    ('PRES_SICOS', 'Presentación SICOS', 
        (SELECT id FROM rubros_tarea WHERE codigo = 'sindicatos'), 90, TRUE, TRUE),
    ('DEC_IVA', 'Declaración IVA', 
        (SELECT id FROM rubros_tarea WHERE codigo = 'impuestos'), 60, TRUE, FALSE),
    ('DEC_GANANCIAS', 'Declaración Ganancias', 
        (SELECT id FROM rubros_tarea WHERE codigo = 'impuestos'), 90, TRUE, FALSE),
    ('BALANCE_ANUAL', 'Balance Anual', 
        (SELECT id FROM rubros_tarea WHERE codigo = 'contabilidad'), 480, TRUE, FALSE),
    ('CONCIL_BANCARIA', 'Conciliación Bancaria', 
        (SELECT id FROM rubros_tarea WHERE codigo = 'contabilidad'), 60, TRUE, FALSE),
    ('AUDITORIA_INT', 'Auditoría Interna', 
        (SELECT id FROM rubros_tarea WHERE codigo = 'auditoria'), 240, TRUE, FALSE);

-- ============================================================
-- PERMISOS (para Supabase Row Level Security)
-- ============================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguimiento_complejo ENABLE ROW LEVEL SECURITY;

-- Las políticas de RLS se configuran en la app backend
-- (Supabase service_role key bypassa RLS)

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
-- Para verificar que todo quedó bien:
SELECT 'Tablas creadas: ' || COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
