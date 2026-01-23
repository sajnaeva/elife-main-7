-- Add approval_status to communities table
ALTER TABLE public.communities 
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending';

-- Add approval_status to jobs table
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending';

-- Update businesses default approval_status to pending
ALTER TABLE public.businesses 
ALTER COLUMN approval_status SET DEFAULT 'pending';

-- Update existing records to 'approved' so they remain visible
UPDATE public.communities SET approval_status = 'approved' WHERE approval_status IS NULL;
UPDATE public.jobs SET approval_status = 'approved' WHERE approval_status IS NULL;

-- Drop existing SELECT policies that need updating
DROP POLICY IF EXISTS "Businesses are viewable by everyone" ON public.businesses;
DROP POLICY IF EXISTS "Communities are viewable by everyone" ON public.communities;
DROP POLICY IF EXISTS "Anyone can view active communities" ON public.communities;
DROP POLICY IF EXISTS "Anyone can view open jobs" ON public.jobs;

-- Create new policies that filter by approval_status
-- Businesses: only approved ones visible to public, owners see their own
CREATE POLICY "Approved businesses are viewable by everyone" 
ON public.businesses 
FOR SELECT 
USING (
  approval_status = 'approved' 
  OR owner_id = auth.uid() 
  OR has_any_admin_role(auth.uid())
);

-- Communities: only approved ones visible to public, creators see their own
CREATE POLICY "Approved communities are viewable by everyone" 
ON public.communities 
FOR SELECT 
USING (
  (approval_status = 'approved' AND (is_disabled = false OR is_disabled IS NULL))
  OR created_by = auth.uid() 
  OR has_any_admin_role(auth.uid())
);

-- Jobs: only approved and open ones visible to public, creators see their own
CREATE POLICY "Approved open jobs are viewable" 
ON public.jobs 
FOR SELECT 
USING (
  (approval_status = 'approved' AND status = 'open'::job_status)
  OR creator_id = auth.uid() 
  OR has_any_admin_role(auth.uid())
);