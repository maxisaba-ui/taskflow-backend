-- ============================================================
-- TaskFlow Pro — Script de datos de prueba
-- Ejecutar DESPUÉS del script 01_crear_base_de_datos.sql
-- Sirve para probar el sistema antes de cargarlo con datos reales
-- ============================================================

-- ============================================================
-- USUARIOS DE PRUEBA
-- ⚠️ Reemplazá los emails con emails de Google reales que tengas
-- ============================================================

INSERT INTO usuarios (email, nombre, apellido, activo, fecha_alta) VALUES
    ('admin@miestudio.com',       'Carlos',   'García',    TRUE, '2025-01-01'),
    ('supervisor@miestudio.com',  'María',    'López',     TRUE, '2025-01-01'),
    ('operador1@miestudio.com',   'Juan',     'Martínez',  TRUE, '2025-01-01'),
    ('operador2@miestudio.com',   'Lucía',    'Fernández', TRUE, '2025-01-01'),
    ('operador3@miestudio.com',   'Diego',    'Romero',    TRUE, '2025-01-01');

-- Asignar perfiles
-- Carlos: administrador + dueño
INSERT INTO usuario_perfiles (usuario_id, perfil_id, activo, fecha_alta)
SELECT u.id, p.id, TRUE, CURRENT_DATE
FROM usuarios u CROSS JOIN perfiles p
WHERE u.email = 'admin@miestudio.com' AND p.codigo IN ('administrador','dueno');

-- María: supervisora
INSERT INTO usuario_perfiles (usuario_id, perfil_id, activo, fecha_alta)
SELECT u.id, p.id, TRUE, CURRENT_DATE
FROM usuarios u CROSS JOIN perfiles p
WHERE u.email = 'supervisor@miestudio.com' AND p.codigo = 'supervisor';

-- Operadores
INSERT INTO usuario_perfiles (usuario_id, perfil_id, activo, fecha_alta)
SELECT u.id, p.id, TRUE, CURRENT_DATE
FROM usuarios u CROSS JOIN perfiles p
WHERE u.email IN ('operador1@miestudio.com','operador2@miestudio.com','operador3@miestudio.com')
  AND p.codigo = 'operador';

-- Asignar supervisora a los operadores
INSERT INTO supervisor_operador (supervisor_id, operador_id, activo, fecha_inicio)
SELECT s.id, o.id, TRUE, CURRENT_DATE
FROM usuarios s, usuarios o
WHERE s.email = 'supervisor@miestudio.com'
  AND o.email IN ('operador1@miestudio.com','operador2@miestudio.com','operador3@miestudio.com');

-- ============================================================
-- CLIENTES DE PRUEBA
-- ============================================================

INSERT INTO clientes (razon_social, cuit, email, telefono, localidad, activo, fecha_alta) VALUES
    ('Empresa ABC S.A.',          '30-71234567-8', 'contacto@empresaabc.com',   '011-4567-8901', 'CABA',          TRUE, '2025-01-01'),
    ('Industrias XYZ S.R.L.',     '30-61234567-9', 'admin@industriasxyz.com',   '011-5678-9012', 'Córdoba',       TRUE, '2025-01-01'),
    ('Comercial Norte S.A.',      '30-51234567-0', 'info@comercialnorte.com',   '011-6789-0123', 'Rosario',       TRUE, '2025-01-01'),
    ('Tecno Solutions S.R.L.',    '30-41234567-1', 'contab@tecnosolutions.com', '011-7890-1234', 'CABA',          TRUE, '2025-01-01'),
    ('Distribuidora Sur S.A.',    '30-31234567-2', 'gerencia@distsur.com',      '011-8901-2345', 'La Plata',      TRUE, '2025-01-01'),
    ('Constructora Plaza S.R.L.', '30-21234567-3', 'admin@constrplaza.com',     '011-9012-3456', 'Buenos Aires',  TRUE, '2025-01-01');

-- ============================================================
-- SERVICIOS DE PRUEBA
-- ============================================================

INSERT INTO servicios (codigo, nombre, rubro_id, tipo_calendarizacion, activo) VALUES
    ('LIQ_SUELDOS_MEN', 'Liquidación de Sueldos Mensual',
        (SELECT id FROM rubros_tarea WHERE codigo = 'sueldos'), 'manual', TRUE),
    ('IMPUESTOS_MEN',   'Presentación de Impuestos Mensual',
        (SELECT id FROM rubros_tarea WHERE codigo = 'impuestos'), 'fecha_fija', TRUE),
    ('CONTAB_MEN',      'Contabilidad Mensual',
        (SELECT id FROM rubros_tarea WHERE codigo = 'contabilidad'), 'fecha_fija', TRUE),
    ('SINDICAL_MEN',    'Presentaciones Sindicales Mensuales',
        (SELECT id FROM rubros_tarea WHERE codigo = 'sindicatos'), 'fecha_fija', TRUE);

-- Asignar servicios a clientes (algunos clientes tienen varios servicios)
INSERT INTO cliente_servicios (cliente_id, servicio_id, activo, fecha_inicio)
SELECT c.id, s.id, TRUE, '2025-01-01'
FROM clientes c CROSS JOIN servicios s
WHERE c.razon_social = 'Empresa ABC S.A.'
  AND s.codigo IN ('LIQ_SUELDOS_MEN','IMPUESTOS_MEN','CONTAB_MEN');

INSERT INTO cliente_servicios (cliente_id, servicio_id, activo, fecha_inicio)
SELECT c.id, s.id, TRUE, '2025-01-01'
FROM clientes c CROSS JOIN servicios s
WHERE c.razon_social = 'Industrias XYZ S.R.L.'
  AND s.codigo IN ('LIQ_SUELDOS_MEN','IMPUESTOS_MEN','CONTAB_MEN','SINDICAL_MEN');

INSERT INTO cliente_servicios (cliente_id, servicio_id, activo, fecha_inicio)
SELECT c.id, s.id, TRUE, '2025-01-01'
FROM clientes c CROSS JOIN servicios s
WHERE c.razon_social IN ('Comercial Norte S.A.','Tecno Solutions S.R.L.')
  AND s.codigo IN ('IMPUESTOS_MEN','CONTAB_MEN');

-- ============================================================
-- TAREAS DE PRUEBA PARA HOY
-- ============================================================

-- Tareas de Juan (operador1) para hoy
INSERT INTO tareas (
    catalogo_tarea_id, rubro_id, asignado_a_id, cliente_id,
    fecha_planificada, prioridad, estado,
    creada_por_id, tipo_creacion, comentario_supervisor
)
SELECT
    ct.id,
    ct.rubro_id,
    op.id,
    cl.id,
    CURRENT_DATE,
    'alta',
    'pendiente',
    sup.id,
    'supervisor',
    'Verificar los últimos movimientos antes de procesar'
FROM catalogo_tareas ct, usuarios op, clientes cl, usuarios sup
WHERE ct.codigo = 'DEC_IVA'
  AND op.email = 'operador1@miestudio.com'
  AND cl.razon_social = 'Empresa ABC S.A.'
  AND sup.email = 'supervisor@miestudio.com';

INSERT INTO tareas (
    catalogo_tarea_id, rubro_id, asignado_a_id, cliente_id,
    fecha_planificada, prioridad, estado,
    creada_por_id, tipo_creacion
)
SELECT
    ct.id, ct.rubro_id, op.id, cl.id,
    CURRENT_DATE, 'media', 'pendiente', sup.id, 'supervisor'
FROM catalogo_tareas ct, usuarios op, clientes cl, usuarios sup
WHERE ct.codigo = 'CONCIL_BANCARIA'
  AND op.email = 'operador1@miestudio.com'
  AND cl.razon_social = 'Comercial Norte S.A.'
  AND sup.email = 'supervisor@miestudio.com';

INSERT INTO tareas (
    catalogo_tarea_id, rubro_id, asignado_a_id, cliente_id,
    fecha_planificada, prioridad, estado,
    creada_por_id, tipo_creacion, comentario_supervisor
)
SELECT
    ct.id, ct.rubro_id, op.id, cl.id,
    CURRENT_DATE, 'alta', 'pendiente', sup.id, 'supervisor',
    'Novedades recibidas ayer. Plazo: mañana a las 18hs'
FROM catalogo_tareas ct, usuarios op, clientes cl, usuarios sup
WHERE ct.codigo = 'LIQ_SUELDOS'
  AND op.email = 'operador1@miestudio.com'
  AND cl.razon_social = 'Industrias XYZ S.R.L.'
  AND sup.email = 'supervisor@miestudio.com';

-- Tareas de Lucía (operador2)
INSERT INTO tareas (
    catalogo_tarea_id, rubro_id, asignado_a_id, cliente_id,
    fecha_planificada, prioridad, estado,
    creada_por_id, tipo_creacion
)
SELECT
    ct.id, ct.rubro_id, op.id, cl.id,
    CURRENT_DATE, 'alta', 'pendiente', sup.id, 'supervisor'
FROM catalogo_tareas ct, usuarios op, clientes cl, usuarios sup
WHERE ct.codigo = 'DEC_GANANCIAS'
  AND op.email = 'operador2@miestudio.com'
  AND cl.razon_social = 'Tecno Solutions S.R.L.'
  AND sup.email = 'supervisor@miestudio.com';

INSERT INTO tareas (
    catalogo_tarea_id, rubro_id, asignado_a_id, cliente_id,
    fecha_planificada, prioridad, estado,
    creada_por_id, tipo_creacion
)
SELECT
    ct.id, ct.rubro_id, op.id, cl.id,
    CURRENT_DATE, 'media', 'pendiente', sup.id, 'supervisor'
FROM catalogo_tareas ct, usuarios op, clientes cl, usuarios sup
WHERE ct.codigo = 'PRES_SINDICAL'
  AND op.email = 'operador2@miestudio.com'
  AND cl.razon_social = 'Industrias XYZ S.R.L.'
  AND sup.email = 'supervisor@miestudio.com';

-- Tareas de Diego (operador3)
INSERT INTO tareas (
    catalogo_tarea_id, rubro_id, asignado_a_id, cliente_id,
    fecha_planificada, prioridad, estado,
    creada_por_id, tipo_creacion
)
SELECT
    ct.id, ct.rubro_id, op.id, cl.id,
    CURRENT_DATE, 'media', 'pendiente', sup.id, 'supervisor'
FROM catalogo_tareas ct, usuarios op, clientes cl, usuarios sup
WHERE ct.codigo = 'CONCIL_BANCARIA'
  AND op.email = 'operador3@miestudio.com'
  AND cl.razon_social = 'Distribuidora Sur S.A.'
  AND sup.email = 'supervisor@miestudio.com';

-- ============================================================
-- SEGUIMIENTO COMPLEJO DE PRUEBA
-- ============================================================

-- Crear un seguimiento de liquidación de sueldos para el mes actual
WITH nuevo_seg AS (
    INSERT INTO seguimiento_complejo (
        nombre, cliente_id, servicio_id, responsable_id,
        periodo, tipo, estado, fecha_vencimiento
    )
    SELECT
        'Liquidación Sueldos Enero 2025',
        c.id, s.id, u.id,
        TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
        'hacia_adelante',
        'en_curso',
        CURRENT_DATE + 5
    FROM clientes c, servicios s, usuarios u
    WHERE c.razon_social = 'Empresa ABC S.A.'
      AND s.codigo = 'LIQ_SUELDOS_MEN'
      AND u.email = 'operador1@miestudio.com'
    RETURNING id
)
-- Insertar etapas de ese seguimiento
INSERT INTO seguimiento_etapas (
    seguimiento_id, orden, nombre, es_obligatoria,
    tipo_limite, limite_cantidad, estado, fecha_limite_calculada
)
SELECT
    nuevo_seg.id, etapas.orden, etapas.nombre,
    etapas.obligatoria, etapas.tipo_limite,
    etapas.limite, etapas.estado,
    CURRENT_DATE + etapas.dias_limite
FROM nuevo_seg,
(VALUES
    (1, 'Recepción de Novedades', TRUE,  'horas_habiles_despues_inicio_seguimiento', 0,  'completada_ok', 0),
    (2, 'Liquidación',            TRUE,  'horas_habiles_despues_etapa_anterior',      24, 'advertencia_hoy', 1),
    (3, 'Revisión',               TRUE,  'horas_habiles_despues_etapa_anterior',      24, 'pendiente', 2),
    (4, 'Envío al Cliente',       TRUE,  'horas_habiles_despues_etapa_anterior',      24, 'pendiente', 3)
) AS etapas(orden, nombre, obligatoria, tipo_limite, limite, estado, dias_limite);

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================

SELECT '=== VERIFICACIÓN DE DATOS DE PRUEBA ===' AS info;
SELECT 'Usuarios creados: '    || COUNT(*) FROM usuarios;
SELECT 'Clientes creados: '    || COUNT(*) FROM clientes;
SELECT 'Servicios creados: '   || COUNT(*) FROM servicios;
SELECT 'Tareas de hoy: '       || COUNT(*) FROM tareas WHERE fecha_planificada = CURRENT_DATE;
SELECT 'Seguimientos: '        || COUNT(*) FROM seguimiento_complejo;
SELECT '=== DATOS DE PRUEBA CARGADOS CORRECTAMENTE ===' AS resultado;
