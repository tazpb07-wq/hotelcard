ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS pix_account_name text,
  ADD COLUMN IF NOT EXISTS pix_bank_name text;