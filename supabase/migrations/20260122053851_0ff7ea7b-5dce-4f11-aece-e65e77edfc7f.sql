-- Create a trigger function to auto-assign super_admin role for specific email
CREATE OR REPLACE FUNCTION public.auto_assign_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the new user has the super admin email
  IF NEW.email = 'evamarketingsolutions@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table (fires when profile is created after signup)
DROP TRIGGER IF EXISTS assign_super_admin_trigger ON public.profiles;
CREATE TRIGGER assign_super_admin_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_super_admin();