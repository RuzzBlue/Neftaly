-- Permisos de configuración limitada para líderes (staff)
-- Ejecutar en Supabase → SQL Editor

-- Ciclo actual: staff puede leer y cambiar
DROP POLICY IF EXISTS "app_config_staff_update" ON public.app_config;
CREATE POLICY "app_config_staff_update" ON public.app_config
  FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Patrullas: staff puede editar (nombre/color), no crear ni borrar
DROP POLICY IF EXISTS "patrullas_staff_update" ON public.patrullas;
CREATE POLICY "patrullas_staff_update" ON public.patrullas
  FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
