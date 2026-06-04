-- ============================================================
-- MIGRACIÓN: agrega columna fue_vencida a tareas
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE tareas ADD COLUMN IF NOT EXISTS fue_vencida BOOLEAN DEFAULT FALSE;

-- Backfill: tareas completadas cuyo fin_real superó la fecha de vencimiento
UPDATE tareas
SET fue_vencida = TRUE
WHERE fue_vencida = FALSE
  AND estado = 'completada'
  AND fin_real IS NOT NULL
  AND fecha_vencimiento IS NOT NULL
  AND fin_real::date > fecha_vencimiento;

-- Backfill: tareas que aún están en estado vencida
UPDATE tareas
SET fue_vencida = TRUE
WHERE fue_vencida = FALSE
  AND estado = 'vencida';
