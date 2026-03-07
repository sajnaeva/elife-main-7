
-- Create cash collection status enum
CREATE TYPE public.cash_collection_status AS ENUM ('pending', 'verified', 'submitted');

-- Create cash_collections table
CREATE TABLE public.cash_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  mobile text NOT NULL,
  panchayath_id uuid REFERENCES public.panchayaths(id),
  panchayath_name text,
  member_id uuid REFERENCES public.members(id),
  amount numeric NOT NULL DEFAULT 0,
  receipt_number text UNIQUE,
  status cash_collection_status NOT NULL DEFAULT 'pending',
  notes text,
  collected_by text NOT NULL,
  collected_by_name text,
  verified_by text,
  verified_by_name text,
  verified_at timestamp with time zone,
  submitted_by text,
  submitted_by_name text,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cash_collections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view collections in their division"
  ON public.cash_collections FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    AND division_id = get_user_division(auth.uid())
  );

CREATE POLICY "Super admin can manage all collections"
  ON public.cash_collections FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can insert collections in their division"
  ON public.cash_collections FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND division_id = get_user_division(auth.uid())
  );

CREATE POLICY "Admins can update collections in their division"
  ON public.cash_collections FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND division_id = get_user_division(auth.uid())
  );

-- Generate receipt number function
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  seq_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN receipt_number ~ '^RCT-[0-9]+$' 
    THEN CAST(SUBSTRING(receipt_number FROM 5) AS integer) 
    ELSE 0 END
  ), 0) + 1 INTO seq_num FROM public.cash_collections;
  
  NEW.receipt_number := 'RCT-' || LPAD(seq_num::text, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_receipt_number
  BEFORE INSERT ON public.cash_collections
  FOR EACH ROW
  WHEN (NEW.receipt_number IS NULL)
  EXECUTE FUNCTION public.generate_receipt_number();

-- Update timestamp trigger
CREATE TRIGGER update_cash_collections_updated_at
  BEFORE UPDATE ON public.cash_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
