-- Add new status to reservation_status enum
ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'aguardando_assinatura';

-- Add contract_link column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS contract_link text DEFAULT NULL;