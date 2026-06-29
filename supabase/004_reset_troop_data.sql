-- Ejecutar en Supabase SQL Editor (después de 001_schema.sql)
-- Reinicio configurable: conservar patrullas, miembros y/o asistencia

CREATE OR REPLACE FUNCTION public.reset_troop_data(
  keep_patrullas BOOLEAN DEFAULT false,
  keep_miembros BOOLEAN DEFAULT false,
  keep_asistencia BOOLEAN DEFAULT false
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo administradores';
  END IF;

  IF keep_miembros AND NOT keep_patrullas THEN
    RAISE EXCEPTION 'No se pueden conservar miembros sin patrullas';
  END IF;

  IF keep_asistencia AND NOT keep_miembros THEN
    RAISE EXCEPTION 'No se puede conservar asistencia sin miembros';
  END IF;

  -- Siempre reiniciar puntos y registro de acciones
  DELETE FROM public.action_log;
  DELETE FROM public.puntos_crecimiento;
  DELETE FROM public.puntos_patrulla;

  IF NOT keep_asistencia THEN
    DELETE FROM public.asistencia;
  END IF;

  IF NOT keep_miembros THEN
    DELETE FROM public.miembro_cargos;
    DELETE FROM public.miembros;
  END IF;

  IF NOT keep_patrullas THEN
    DELETE FROM public.cargos;
    DELETE FROM public.patrullas;
  END IF;

  UPDATE public.app_config SET value = '1' WHERE key = 'ciclo_actual';
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_troop_data(BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_all_data()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.reset_troop_data(false, false, false);
END;
$$;

-- Recargar caché de API tras crear la función
NOTIFY pgrst, 'reload schema';
