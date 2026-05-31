-- =============================================================================
-- Migración: email automático al completar tareas
-- Ejecutar en Supabase SQL Editor UNA SOLA VEZ.
-- =============================================================================

ALTER TABLE catalogo_tareas
  ADD COLUMN IF NOT EXISTS enviar_email_al_completar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_asunto TEXT,
  ADD COLUMN IF NOT EXISTS email_cuerpo TEXT;

-- Verificación
SELECT codigo, nombre, enviar_email_al_completar
FROM catalogo_tareas
WHERE activo = TRUE
ORDER BY nombre
LIMIT 10;
