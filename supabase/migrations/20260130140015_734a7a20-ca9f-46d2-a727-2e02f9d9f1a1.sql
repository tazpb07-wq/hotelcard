-- Add pix_method column to store the payment method type
ALTER TABLE public.reservations 
ADD COLUMN pix_method TEXT DEFAULT 'copiar_colar' CHECK (pix_method IN ('email', 'telefone', 'copiar_colar'));