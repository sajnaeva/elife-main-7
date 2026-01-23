-- Assign super_admin role to user with mobile 9497589091
INSERT INTO public.user_roles (user_id, role)
VALUES ('cd69eeda-40e5-464d-9a7b-5c07d4aff77b', 'super_admin')
ON CONFLICT DO NOTHING;