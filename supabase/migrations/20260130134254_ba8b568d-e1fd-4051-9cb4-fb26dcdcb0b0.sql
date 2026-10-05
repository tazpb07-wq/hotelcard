-- Add 'aguardando_pix' to reservation_status enum
ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'aguardando_pix';