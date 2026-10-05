-- Add new status to reservation_status enum
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'aguardando_pagamento';

-- Add payment_link column to reservations table
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS payment_link TEXT DEFAULT NULL;