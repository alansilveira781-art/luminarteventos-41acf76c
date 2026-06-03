-- Public view of profiles exposing only non-sensitive fields (no email).
-- security_invoker=off so it bypasses the owner-only RLS on profiles, allowing
-- any authenticated user to resolve display names for mentions/UI.
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=off) AS
SELECT id, display_name
FROM public.profiles;

REVOKE ALL ON public.profiles_public FROM PUBLIC, anon;
GRANT SELECT ON public.profiles_public TO authenticated;