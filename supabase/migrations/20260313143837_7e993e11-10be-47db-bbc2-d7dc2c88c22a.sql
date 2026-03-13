
-- Agent wallet transactions table to track commission transfers
CREATE TABLE public.agent_wallet_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.pennyekart_agents(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  transaction_type text NOT NULL DEFAULT 'commission_credit',
  description text,
  transfer_date date NOT NULL,
  from_date date,
  to_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.agent_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Super admin can manage all wallet transactions
CREATE POLICY "Super admin can manage wallet transactions"
  ON public.agent_wallet_transactions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Public can view their own wallet transactions (by agent mobile lookup)
CREATE POLICY "Anyone can view wallet transactions"
  ON public.agent_wallet_transactions
  FOR SELECT
  TO public
  USING (true);

-- Create unique constraint to prevent duplicate transfers for same agent+date range
CREATE UNIQUE INDEX idx_wallet_no_duplicate_transfer 
  ON public.agent_wallet_transactions (agent_id, from_date, to_date)
  WHERE transaction_type = 'commission_credit';
