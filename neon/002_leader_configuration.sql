-- Leaders manage troop records. Only Super Admin controls cycle and troop reset.
BEGIN;

DROP POLICY IF EXISTS app_config_staff_update ON public.app_config;
DROP POLICY IF EXISTS config_insert_admin ON public.app_config;
CREATE POLICY config_insert_admin ON public.app_config AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS config_update_admin ON public.app_config;
CREATE POLICY config_update_admin ON public.app_config AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS config_delete_admin ON public.app_config;
CREATE POLICY config_delete_admin ON public.app_config AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS configuration_staff ON public.patrullas;
CREATE POLICY configuration_staff ON public.patrullas FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS configuration_staff ON public.miembros;
CREATE POLICY configuration_staff ON public.miembros FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS configuration_staff ON public.cargos;
CREATE POLICY configuration_staff ON public.cargos FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Delete dependent history only as part of deleting its member/patrol. Leaders
-- do not gain general permission to erase point history or run the annual reset.
CREATE OR REPLACE FUNCTION public.delete_troop_members(member_ids integer[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.puntos_crecimiento WHERE miembro_id = ANY(member_ids);
  DELETE FROM public.miembros WHERE id = ANY(member_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_troop_patrol(patrol_id integer, delete_members boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_id integer;
  deleted_name text;
  default_number integer := 1;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(43894127);
  SELECT nombre INTO deleted_name FROM public.patrullas WHERE id = patrol_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Patrulla no encontrada'; END IF;
  IF delete_members THEN
    PERFORM public.delete_troop_members(ARRAY(SELECT id FROM public.miembros WHERE patrulla_id = patrol_id));
  ELSIF EXISTS (SELECT 1 FROM public.miembros WHERE patrulla_id = patrol_id) THEN
    SELECT id INTO target_id FROM public.patrullas
      WHERE id <> patrol_id AND nombre ~* '^default\s+[0-9]+$'
      ORDER BY id LIMIT 1;
    IF target_id IS NULL THEN
      WHILE lower(deleted_name) = 'default ' || default_number LOOP
        default_number := default_number + 1;
      END LOOP;
      INSERT INTO public.patrullas(nombre, color, orden)
        VALUES ('Default ' || default_number, '#6c757d', 999)
        ON CONFLICT(nombre) DO UPDATE SET nombre = EXCLUDED.nombre
        RETURNING id INTO target_id;
    END IF;
    UPDATE public.miembros SET patrulla_id = target_id, es_guia = false, es_subguia = false
      WHERE patrulla_id = patrol_id;
  END IF;
  DELETE FROM public.puntos_patrulla WHERE patrulla_id = patrol_id;
  DELETE FROM public.patrullas WHERE id = patrol_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_troop_members(integer[]), public.delete_troop_patrol(integer,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_troop_members(integer[]), public.delete_troop_patrol(integer,boolean) TO authenticated;
COMMIT;
