-- Add guest information columns to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS guest_name TEXT,
ADD COLUMN IF NOT EXISTS guest_cpf TEXT,
ADD COLUMN IF NOT EXISTS guest_phone TEXT,
ADD COLUMN IF NOT EXISTS guest_email TEXT,
ADD COLUMN IF NOT EXISTS guest_address TEXT,
ADD COLUMN IF NOT EXISTS guest_number TEXT,
ADD COLUMN IF NOT EXISTS guest_cep TEXT;