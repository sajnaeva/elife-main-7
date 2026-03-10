CREATE POLICY "Public can check status by mobile"
ON public.cash_collections
FOR SELECT
TO public
USING (true);