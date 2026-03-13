
ALTER TABLE public.pennyekart_orders 
ADD COLUMN IF NOT EXISTS godown_type text DEFAULT '',
ADD COLUMN IF NOT EXISTS self_pickup text DEFAULT '',
ADD COLUMN IF NOT EXISTS delivery text DEFAULT '',
ADD COLUMN IF NOT EXISTS net_profit numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS uploaded_at timestamptz DEFAULT now();
