-- Insert super_admin role for Eva Marketing user
INSERT INTO public.user_roles (user_id, role)
VALUES ('5fdc7f59-9909-459d-8501-2e36bff64849', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Update the profile to have the email for future reference
UPDATE public.profiles
SET email = 'evamarketingsolutions@gmail.com'
WHERE id = '5fdc7f59-9909-459d-8501-2e36bff64849'
AND email IS NULL;