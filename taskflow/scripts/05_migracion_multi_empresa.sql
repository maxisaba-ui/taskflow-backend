-- =============================================================================
-- Migración: completar soporte multi-empresa
-- Ejecutar en Supabase SQL Editor UNA SOLA VEZ.
-- Cada bloque usa IF NOT EXISTS / ON CONFLICT para ser idempotente.
-- =============================================================================

-- 1. Columna color_primario en empresas (referenciada por auth.py)
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS color_primario VARCHAR(7) DEFAULT '#6366f1';

-- 2. Columnas SMTP en empresas (usadas por GestionEmpresa)
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS smtp_host      VARCHAR(200),
  ADD COLUMN IF NOT EXISTS smtp_puerto    INTEGER DEFAULT 587,
  ADD COLUMN IF NOT EXISTS smtp_usuario   VARCHAR(200),
  ADD COLUMN IF NOT EXISTS smtp_password_enc TEXT;

-- 3. Tabla usuario_empresas (relación N:M usuario ↔ empresa)
CREATE TABLE IF NOT EXISTS usuario_empresas (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_alta  DATE DEFAULT CURRENT_DATE,
    fecha_baja  DATE,
    creado_en   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, empresa_id)
);
CREATE INDEX IF NOT EXISTS idx_usuario_empresas_usuario ON usuario_empresas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_empresas_empresa ON usuario_empresas(empresa_id);

-- 4. Migrar usuarios existentes: asignarlos a la empresa activa actual
INSERT INTO usuario_empresas (usuario_id, empresa_id, activo, fecha_alta)
SELECT u.id, e.id, TRUE, CURRENT_DATE
FROM   usuarios u
CROSS JOIN (SELECT id FROM empresas WHERE activa = TRUE LIMIT 1) e
ON CONFLICT (usuario_id, empresa_id) DO NOTHING;

-- 5. empresa_id en tareas (si no existe — en prod ya existe según modelos ORM)
ALTER TABLE tareas
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);

-- Rellenar empresa_id en tareas existentes sin empresa asignada
UPDATE tareas
SET    empresa_id = (SELECT id FROM empresas WHERE activa = TRUE LIMIT 1)
WHERE  empresa_id IS NULL;

-- 6. empresa_id en clientes
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);

UPDATE clientes
SET    empresa_id = (SELECT id FROM empresas WHERE activa = TRUE LIMIT 1)
WHERE  empresa_id IS NULL;

-- 7. empresa_id en servicios
ALTER TABLE servicios
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);

UPDATE servicios
SET    empresa_id = (SELECT id FROM empresas WHERE activa = TRUE LIMIT 1)
WHERE  empresa_id IS NULL;

-- 8. empresa_id en catalogo_tareas
ALTER TABLE catalogo_tareas
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);

UPDATE catalogo_tareas
SET    empresa_id = (SELECT id FROM empresas WHERE activa = TRUE LIMIT 1)
WHERE  empresa_id IS NULL;

-- 9. empresa_id en rubros_tarea
ALTER TABLE rubros_tarea
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);

UPDATE rubros_tarea
SET    empresa_id = (SELECT id FROM empresas WHERE activa = TRUE LIMIT 1)
WHERE  empresa_id IS NULL;

-- 10. empresa_id en feriados
ALTER TABLE feriados
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);

UPDATE feriados
SET    empresa_id = (SELECT id FROM empresas WHERE activa = TRUE LIMIT 1)
WHERE  empresa_id IS NULL;

-- 11. Índices de acceso por empresa (performance)
CREATE INDEX IF NOT EXISTS idx_tareas_empresa         ON tareas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa       ON clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_servicios_empresa      ON servicios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_catalogo_empresa       ON catalogo_tareas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_rubros_empresa         ON rubros_tarea(empresa_id);
CREATE INDEX IF NOT EXISTS idx_feriados_empresa       ON feriados(empresa_id);

-- Verificación final
SELECT
  'usuario_empresas' AS tabla, COUNT(*) AS filas FROM usuario_empresas
UNION ALL
SELECT 'empresas con color_primario', COUNT(*) FROM empresas WHERE color_primario IS NOT NULL
UNION ALL
SELECT 'tareas con empresa_id',       COUNT(*) FROM tareas       WHERE empresa_id IS NOT NULL
UNION ALL
SELECT 'clientes con empresa_id',     COUNT(*) FROM clientes     WHERE empresa_id IS NOT NULL
UNION ALL
SELECT 'servicios con empresa_id',    COUNT(*) FROM servicios    WHERE empresa_id IS NOT NULL;
