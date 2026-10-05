-- Add discount columns to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS discount_type text DEFAULT NULL CHECK (discount_type IN ('percentage', 'fixed', NULL)),
ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS original_price numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_per_night numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.discount_type IS 'Type of discount: percentage or fixed value';
COMMENT ON COLUMN public.reservations.discount_value IS 'Discount value (percentage 0-100 or fixed amount)';
COMMENT ON COLUMN public.reservations.original_price IS 'Original total price before discount';
COMMENT ON COLUMN public.reservations.price_per_night IS 'Price per night at time of reservation';