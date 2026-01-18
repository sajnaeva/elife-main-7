-- Create promotional_content table for banners, posters, videos, offers
CREATE TABLE public.promotional_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('banner', 'poster', 'image', 'video', 'offer')),
  image_url TEXT,
  video_url TEXT,
  link_url TEXT,
  link_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotional_content ENABLE ROW LEVEL SECURITY;

-- Everyone can view active promotional content
CREATE POLICY "Anyone can view active promotional content"
ON public.promotional_content
FOR SELECT
USING (
  is_active = true 
  AND (start_date IS NULL OR start_date <= now()) 
  AND (end_date IS NULL OR end_date >= now())
);

-- Only admins can manage promotional content
CREATE POLICY "Admins can manage promotional content"
ON public.promotional_content
FOR ALL
USING (public.has_any_admin_role(auth.uid()))
WITH CHECK (public.has_any_admin_role(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_promotional_content_updated_at
BEFORE UPDATE ON public.promotional_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();