-- Fix mutable search_path on update_updated_at_column function
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
