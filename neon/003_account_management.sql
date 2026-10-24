BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin' AND NOT blocked);
$$;
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role IN ('admin','leader') AND NOT blocked);
$$;

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
 USING (id=auth.uid() AND NOT blocked) WITH CHECK(id=auth.uid() AND NOT blocked);

CREATE OR REPLACE FUNCTION public.guard_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN
  RAISE EXCEPTION 'La identidad y correo de una cuenta no se cambian aquí';
 END IF;
 IF auth.uid() IS NOT NULL AND NOT public.is_admin() AND
    (NEW.role IS DISTINCT FROM OLD.role OR NEW.blocked IS DISTINCT FROM OLD.blocked) THEN
  RAISE EXCEPTION 'Solo Super Admin puede cambiar el acceso' USING ERRCODE='42501';
 END IF;
 IF auth.uid()=OLD.id AND NEW.blocked THEN RAISE EXCEPTION 'No puedes bloquear tu propia cuenta'; END IF;
 IF OLD.role='admin' AND NOT OLD.blocked AND (NEW.role<>'admin' OR NEW.blocked) THEN
  PERFORM pg_advisory_xact_lock(43894126);
  IF (SELECT count(*) FROM public.profiles WHERE role='admin' AND NOT blocked)<=1 THEN
   RAISE EXCEPTION 'Debe quedar al menos un Super Admin activo';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.account_invitations (
 email text PRIMARY KEY CHECK(email=lower(btrim(email)) AND position('@' IN email)>1),
 nombre text NOT NULL CHECK(length(btrim(nombre))>0),
 role text NOT NULL DEFAULT 'leader' CHECK(role IN ('leader','admin')),
 claimed_by uuid REFERENCES neon_auth.user(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invitations_admin ON public.account_invitations;
CREATE POLICY invitations_admin ON public.account_invitations FOR ALL TO authenticated
 USING(public.is_admin()) WITH CHECK(public.is_admin());
REVOKE ALL ON public.account_invitations FROM PUBLIC, anonymous;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.account_invitations TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_neon_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitation public.account_invitations%ROWTYPE;
BEGIN
 INSERT INTO public.profiles(id,email,nombre,role) VALUES(NEW.id,NEW.email,NEW.name,'pending') ON CONFLICT(id) DO NOTHING;
 IF NEW."emailVerified" THEN
  UPDATE neftaly_private.bootstrap_admin SET claimed_at=now() WHERE email=lower(NEW.email) AND claimed_at IS NULL;
  IF FOUND THEN UPDATE public.profiles SET role='admin' WHERE id=NEW.id; END IF;
  SELECT * INTO invitation FROM public.account_invitations WHERE email=lower(NEW.email) AND claimed_by IS NULL FOR UPDATE;
  IF FOUND AND EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.id AND role='pending' AND NOT blocked) THEN
   UPDATE public.profiles SET role=invitation.role,nombre=invitation.nombre WHERE id=NEW.id;
   UPDATE public.account_invitations SET claimed_by=NEW.id WHERE email=invitation.email;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile(),public.handle_neon_user() FROM PUBLIC;
COMMIT;
