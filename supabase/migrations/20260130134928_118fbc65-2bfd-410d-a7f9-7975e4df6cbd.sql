-- Add pix_message and pix_image_url columns to reservations
ALTER TABLE public.reservations 
ADD COLUMN pix_message TEXT DEFAULT NULL,
ADD COLUMN pix_image_url TEXT DEFAULT NULL;

-- Create storage bucket for pix images
INSERT INTO storage.buckets (id, name, public) VALUES ('pix-images', 'pix-images', true);

-- Allow admins to upload pix images
CREATE POLICY "Admins can upload pix images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'pix-images' AND public.has_role(auth.uid(), 'admin'));

-- Allow admins to update pix images
CREATE POLICY "Admins can update pix images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'pix-images' AND public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete pix images
CREATE POLICY "Admins can delete pix images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'pix-images' AND public.has_role(auth.uid(), 'admin'));

-- Allow public read access to pix images
CREATE POLICY "Anyone can view pix images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'pix-images');