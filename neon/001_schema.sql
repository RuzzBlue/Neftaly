-- Fresh Neon schema. No Supabase data is deleted or imported.
BEGIN;
CREATE SCHEMA IF NOT EXISTS neftaly_private;
REVOKE ALL ON SCHEMA neftaly_private FROM PUBLIC, authenticated, anonymous;
CREATE TABLE IF NOT EXISTS neftaly_private.bootstrap_admin (email text PRIMARY KEY, claimed_at timestamptz);
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES neon_auth.user(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT,
  role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('admin', 'leader', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.patrullas (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6c757d',
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cargos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  orden INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.miembros (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  patrulla_id INT NOT NULL REFERENCES public.patrullas(id) ON DELETE RESTRICT,
  es_guia BOOLEAN NOT NULL DEFAULT false,
  es_subguia BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.miembro_cargos (
  miembro_id INT NOT NULL REFERENCES public.miembros(id) ON DELETE CASCADE,
  cargo_id INT NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  PRIMARY KEY (miembro_id, cargo_id)
);

CREATE TABLE IF NOT EXISTS public.puntos_patrulla (
  id BIGSERIAL PRIMARY KEY,
  patrulla_id INT NOT NULL REFERENCES public.patrullas(id) ON DELETE RESTRICT,
  ciclo INT NOT NULL CHECK (ciclo BETWEEN 1 AND 3),
  delta INT NOT NULL,
  nota TEXT,
  created_by UUID REFERENCES neon_auth.user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.puntos_crecimiento (
  id BIGSERIAL PRIMARY KEY,
  miembro_id INT NOT NULL REFERENCES public.miembros(id) ON DELETE RESTRICT,
  ciclo INT NOT NULL CHECK (ciclo BETWEEN 1 AND 3),
  area TEXT NOT NULL CHECK (area IN (
    'afectividad','creatividad','caracter','sociabilidad','corporalidad','espiritualidad'
  )),
  delta INT NOT NULL,
  nota TEXT,
  created_by UUID REFERENCES neon_auth.user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.asistencia (
  id BIGSERIAL PRIMARY KEY,
  miembro_id INT NOT NULL REFERENCES public.miembros(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('asistio', 'no_asistio', 'licencia')),
  created_by UUID REFERENCES neon_auth.user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (miembro_id, fecha)
);

CREATE TABLE IF NOT EXISTS public.action_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES neon_auth.user(id),
  tipo TEXT NOT NULL,
  detalle JSONB NOT NULL DEFAULT '{}',
  ciclo INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_puntos_patrulla_ciclo ON public.puntos_patrulla (ciclo, patrulla_id);
CREATE INDEX IF NOT EXISTS idx_puntos_crecimiento_ciclo ON public.puntos_crecimiento (ciclo, miembro_id);
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha ON public.asistencia (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_action_log_created ON public.action_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'leader'));
$$;

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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrullas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembro_cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puntos_patrulla ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puntos_crecimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_log ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "profiles_admin" ON public.profiles;
CREATE POLICY "profiles_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- app_config
DROP POLICY IF EXISTS "app_config_select" ON public.app_config;
CREATE POLICY "app_config_select" ON public.app_config FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "app_config_admin" ON public.app_config;
CREATE POLICY "app_config_admin" ON public.app_config FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- patrullas
DROP POLICY IF EXISTS "patrullas_select" ON public.patrullas;
CREATE POLICY "patrullas_select" ON public.patrullas FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "patrullas_admin" ON public.patrullas;
CREATE POLICY "patrullas_admin" ON public.patrullas FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- cargos
DROP POLICY IF EXISTS "cargos_select" ON public.cargos;
CREATE POLICY "cargos_select" ON public.cargos FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "cargos_admin" ON public.cargos;
CREATE POLICY "cargos_admin" ON public.cargos FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- miembros
DROP POLICY IF EXISTS "miembros_select" ON public.miembros;
CREATE POLICY "miembros_select" ON public.miembros FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "miembros_staff_insert" ON public.miembros;
CREATE POLICY "miembros_staff_insert" ON public.miembros FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "miembros_staff_update" ON public.miembros;
CREATE POLICY "miembros_staff_update" ON public.miembros FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "miembros_admin_delete" ON public.miembros;
CREATE POLICY "miembros_admin_delete" ON public.miembros FOR DELETE TO authenticated
  USING (public.is_admin());

-- miembro_cargos
DROP POLICY IF EXISTS "miembro_cargos_select" ON public.miembro_cargos;
CREATE POLICY "miembro_cargos_select" ON public.miembro_cargos FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "miembro_cargos_staff" ON public.miembro_cargos;
CREATE POLICY "miembro_cargos_staff" ON public.miembro_cargos FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "miembro_cargos_admin_delete" ON public.miembro_cargos;
CREATE POLICY "miembro_cargos_admin_delete" ON public.miembro_cargos FOR DELETE TO authenticated
  USING (public.is_admin());

-- puntos_patrulla
DROP POLICY IF EXISTS "puntos_patrulla_select" ON public.puntos_patrulla;
CREATE POLICY "puntos_patrulla_select" ON public.puntos_patrulla FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "puntos_patrulla_insert" ON public.puntos_patrulla;
CREATE POLICY "puntos_patrulla_insert" ON public.puntos_patrulla FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "puntos_patrulla_admin" ON public.puntos_patrulla;
CREATE POLICY "puntos_patrulla_admin" ON public.puntos_patrulla FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "puntos_patrulla_admin_delete" ON public.puntos_patrulla;
CREATE POLICY "puntos_patrulla_admin_delete" ON public.puntos_patrulla FOR DELETE TO authenticated
  USING (public.is_admin());

-- puntos_crecimiento
DROP POLICY IF EXISTS "puntos_crecimiento_select" ON public.puntos_crecimiento;
CREATE POLICY "puntos_crecimiento_select" ON public.puntos_crecimiento FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "puntos_crecimiento_insert" ON public.puntos_crecimiento;
CREATE POLICY "puntos_crecimiento_insert" ON public.puntos_crecimiento FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "puntos_crecimiento_admin" ON public.puntos_crecimiento;
CREATE POLICY "puntos_crecimiento_admin" ON public.puntos_crecimiento FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "puntos_crecimiento_admin_delete" ON public.puntos_crecimiento;
CREATE POLICY "puntos_crecimiento_admin_delete" ON public.puntos_crecimiento FOR DELETE TO authenticated
  USING (public.is_admin());

-- asistencia
DROP POLICY IF EXISTS "asistencia_select" ON public.asistencia;
CREATE POLICY "asistencia_select" ON public.asistencia FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "asistencia_write" ON public.asistencia;
CREATE POLICY "asistencia_write" ON public.asistencia FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "asistencia_admin_delete" ON public.asistencia;
CREATE POLICY "asistencia_admin_delete" ON public.asistencia FOR DELETE TO authenticated
  USING (public.is_admin());

-- action_log
DROP POLICY IF EXISTS "action_log_select" ON public.action_log;
CREATE POLICY "action_log_select" ON public.action_log FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "action_log_insert" ON public.action_log;
CREATE POLICY "action_log_insert" ON public.action_log FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "action_log_admin_delete" ON public.action_log;
CREATE POLICY "action_log_admin_delete" ON public.action_log FOR DELETE TO authenticated
  USING (public.is_admin());

-- Permisos de configuración limitada para líderes (staff)
-- Additional staff permissions.

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

CREATE OR REPLACE FUNCTION public.guard_profile() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.is_admin() AND
   (NEW.role IS DISTINCT FROM OLD.role OR NEW.email IS DISTINCT FROM OLD.email OR NEW.id IS DISTINCT FROM OLD.id) THEN
   RAISE EXCEPTION 'No puedes cambiar correo, identidad o rol';
 END IF;
 IF OLD.role = 'admin' AND NEW.role <> 'admin' THEN
  PERFORM pg_advisory_xact_lock(43894126);
 END IF;
 IF OLD.role = 'admin' AND NEW.role <> 'admin' AND
   (SELECT count(*) FROM public.profiles WHERE role = 'admin') <= 1 THEN
   RAISE EXCEPTION 'Debe quedar al menos un Super Admin';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_profile ON public.profiles;
CREATE TRIGGER guard_profile BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile();
CREATE OR REPLACE FUNCTION public.handle_neon_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.profiles(id,email,nombre,role) VALUES
 (NEW.id,NEW.email,NEW.name,'pending') ON CONFLICT(id) DO NOTHING;
 IF NEW."emailVerified" AND EXISTS (SELECT 1 FROM neftaly_private.bootstrap_admin WHERE email=lower(NEW.email) AND claimed_at IS NULL) THEN
  UPDATE neftaly_private.bootstrap_admin SET claimed_at=now() WHERE email=lower(NEW.email) AND claimed_at IS NULL;
  IF FOUND THEN UPDATE public.profiles SET role='admin' WHERE id=NEW.id; END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS neftaly_new_user ON neon_auth.user;
CREATE TRIGGER neftaly_new_user AFTER INSERT OR UPDATE OF "emailVerified" ON neon_auth.user FOR EACH ROW EXECUTE FUNCTION public.handle_neon_user();
INSERT INTO public.profiles(id,email,nombre,role)
SELECT id,email,name,'pending' FROM neon_auth.user ON CONFLICT(id) DO NOTHING;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anonymous;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
REVOKE INSERT,DELETE ON public.profiles FROM authenticated;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
REVOKE ALL ON FUNCTION public.handle_neon_user(), public.guard_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_troop_data(boolean,boolean,boolean),public.clear_all_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_troop_data(boolean,boolean,boolean), public.clear_all_data() TO authenticated;
-- Restrictive insert policies also constrain permissive admin policies.
DROP POLICY IF EXISTS puntos_author ON public.puntos_patrulla;
CREATE POLICY puntos_author ON public.puntos_patrulla AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS crecimiento_author ON public.puntos_crecimiento;
CREATE POLICY crecimiento_author ON public.puntos_crecimiento AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS attendance_author ON public.asistencia;
CREATE POLICY attendance_author ON public.asistencia AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS log_author ON public.action_log;
CREATE POLICY log_author ON public.action_log AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
INSERT INTO public.app_config(key,value) VALUES('ciclo_actual','1') ON CONFLICT(key) DO NOTHING;

COMMIT;
