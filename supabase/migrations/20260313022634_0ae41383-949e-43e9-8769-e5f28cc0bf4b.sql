
-- Commission rates per agent role
CREATE TABLE public.payout_commission_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL UNIQUE,
  percentage numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.payout_commission_rates ENABLE ROW LEVEL SECURITY;

-- Super admin can manage commission rates
CREATE POLICY "Super admin can manage commission rates"
  ON public.payout_commission_rates
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Anyone authenticated can read rates
CREATE POLICY "Authenticated can view commission rates"
  ON public.payout_commission_rates
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed default rates for each role
INSERT INTO public.payout_commission_rates (role, percentage) VALUES
  ('team_leader', 1),
  ('coordinator', 1.5),
  ('group_leader', 2),
  ('pro', 3);
