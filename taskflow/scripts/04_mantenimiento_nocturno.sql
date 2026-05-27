-- ============================================================
-- TaskFlow Pro — Script de mantenimiento nocturno
-- Se ejecuta automáticamente a las 23:59 cada día.
-- En Railway: configurar un cron job que llame al endpoint /api/v1/tareas/heredar
-- O ejecutar este SQL directamente desde Supabase con un pg_cron job.
-- ============================================================

-- 1. HEREDAR TAREAS INCOMPLETAS DEL DÍA AL SIGUIENTE
SELECT heredar_tareas_del_dia(CURRENT_DATE) AS tareas_heredadas;

-- 2. MARCAR COMO VENCIDAS las tareas con fecha_vencimiento anterior a hoy
UPDATE tareas
SET estado = 'vencida',
    actualizado_en = NOW()
WHERE estado IN ('pendiente', 'pausada')
  AND fecha_vencimiento < CURRENT_DATE
  AND activa = TRUE;

-- 3. LIMPIAR SESIONES EXPIRADAS (más de 30 días)
UPDATE sesiones
SET activa = FALSE
WHERE expira_en < NOW() - INTERVAL '30 days'
  AND activa = TRUE;

-- 4. LIMPIAR NOTIFICACIONES ANTIGUAS (más de 90 días)
DELETE FROM notificaciones
WHERE creado_en < NOW() - INTERVAL '90 days'
  AND leida = TRUE;

-- 5. REPORTAR RESULTADOS
DO $$
DECLARE
    v_heredadas  INTEGER;
    v_vencidas   INTEGER;
    v_sesiones   INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_vencidas
    FROM tareas
    WHERE estado = 'vencida'
      AND fecha_planificada = CURRENT_DATE;

    RAISE NOTICE '=== Mantenimiento nocturno % ===', CURRENT_DATE;
    RAISE NOTICE 'Tareas vencidas hoy: %', v_vencidas;
    RAISE NOTICE 'Proceso completado OK';
END $$;
