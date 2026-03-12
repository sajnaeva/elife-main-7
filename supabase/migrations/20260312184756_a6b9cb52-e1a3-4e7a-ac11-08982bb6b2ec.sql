
ALTER TABLE public.pennyekart_orders 
ADD COLUMN IF NOT EXISTS raw_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS collected_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS godown text DEFAULT '',
ADD COLUMN IF NOT EXISTS panchayath_name text DEFAULT '',
ADD COLUMN IF NOT EXISTS ward text DEFAULT '',
ADD COLUMN IF NOT EXISTS district text DEFAULT '',
ADD COLUMN IF NOT EXISTS cost_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_amount numeric NOT NULL DEFAULT 0;
