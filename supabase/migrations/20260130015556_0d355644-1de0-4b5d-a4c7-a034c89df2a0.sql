-- Create comments table for property reviews
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_photo_url TEXT,
  comment_text TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Anyone can view visible comments
CREATE POLICY "Anyone can view visible comments"
ON public.comments
FOR SELECT
USING (is_visible = true);

-- Admins can view all comments
CREATE POLICY "Admins can view all comments"
ON public.comments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert comments
CREATE POLICY "Admins can insert comments"
ON public.comments
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update comments
CREATE POLICY "Admins can update comments"
ON public.comments
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete comments
CREATE POLICY "Admins can delete comments"
ON public.comments
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for client photos
INSERT INTO storage.buckets (id, name, public) VALUES ('client-photos', 'client-photos', true);

-- Storage policies for client photos
CREATE POLICY "Anyone can view client photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'client-photos');

CREATE POLICY "Admins can upload client photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'client-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update client photos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'client-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete client photos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'client-photos' AND has_role(auth.uid(), 'admin'::app_role));