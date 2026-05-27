-- ============================================================
-- TaskFlow Pro — Registrar el primer usuario administrador
-- INSTRUCCIONES:
-- 1. Reemplazá los tres valores marcados con TU DATO
-- 2. Ejecutá en Supabase → SQL Editor
-- ============================================================

DO $$
DECLARE
    v_email     TEXT := 'TU-EMAIL@gmail.com';   -- ← CAMBIÁ ESTO
    v_nombre    TEXT := 'Tu Nombre';             -- ← CAMBIÁ ESTO
    v_apellido  TEXT := 'Tu Apellido';           -- ← CAMBIÁ ESTO
    v_uid       UUID;
BEGIN
    -- Insertar usuario
    INSERT INTO usuarios (email, nombre, apellido, activo, fecha_alta)
    VALUES (v_email, v_nombre, v_apellido, TRUE, CURRENT_DATE)
    ON CONFLICT (email) DO UPDATE SET activo = TRUE
    RETURNING id INTO v_uid;

    -- Asignar perfil administrador
    INSERT INTO usuario_perfiles (usuario_id, perfil_id, activo, fecha_alta)
    SELECT v_uid, p.id, TRUE, CURRENT_DATE
    FROM perfiles p WHERE p.codigo = 'administrador'
    ON CONFLICT (usuario_id, perfil_id) DO NOTHING;

    -- Asignar perfil dueño
    INSERT INTO usuario_perfiles (usuario_id, perfil_id, activo, fecha_alta)
    SELECT v_uid, p.id, TRUE, CURRENT_DATE
    FROM perfiles p WHERE p.codigo = 'dueno'
    ON CONFLICT (usuario_id, perfil_id) DO NOTHING;

    RAISE NOTICE '✅ Usuario administrador creado: %', v_email;
    RAISE NOTICE '   ID: %', v_uid;
    RAISE NOTICE '   Perfiles: administrador, dueño';
    RAISE NOTICE '   Ya puede iniciar sesión con Google en el sistema.';
END $$;
