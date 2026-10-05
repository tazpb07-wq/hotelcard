-- Add new status to reservation_status enum
ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'faltando_cartao';

-- Create table for credit card data (encrypted)
CREATE TABLE public.reservation_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  holder_name text NOT NULL,
  holder_cpf text NOT NULL,
  card_number_encrypted text NOT NULL,
  card_last_four text NOT NULL,
  expiry_month text NOT NULL,
  expiry_year text NOT NULL,
  cvv_encrypted text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(reservation_id)
);

-- Enable RLS
ALTER TABLE public.reservation_cards ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view card data
CREATE POLICY "Admins can view all card data"
ON public.reservation_cards
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Users can insert their own card data (via reservation they own)
CREATE POLICY "Users can insert their own card data"
ON public.reservation_cards
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = reservation_id AND r.user_id = auth.uid()
  )
);

-- Policy: Users can view their own card data (limited)
CREATE POLICY "Users can view their own card data"
ON public.reservation_cards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = reservation_id AND r.user_id = auth.uid()
  )
);

-- Policy: Admins can delete card data
CREATE POLICY "Admins can delete card data"
ON public.reservation_cards
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_reservation_cards_updated_at
BEFORE UPDATE ON public.reservation_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();