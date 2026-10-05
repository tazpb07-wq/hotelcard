-- Create seasonal_rates table for special pricing periods
CREATE TABLE public.seasonal_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_price NUMERIC NOT NULL,
  label TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT positive_price CHECK (daily_price > 0)
);

-- Enable RLS
ALTER TABLE public.seasonal_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view seasonal rates"
ON public.seasonal_rates
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert seasonal rates"
ON public.seasonal_rates
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update seasonal rates"
ON public.seasonal_rates
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete seasonal rates"
ON public.seasonal_rates
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_seasonal_rates_updated_at
BEFORE UPDATE ON public.seasonal_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add price_breakdown column to reservations for audit
ALTER TABLE public.reservations
ADD COLUMN price_breakdown JSONB DEFAULT NULL;

-- Create index for performance
CREATE INDEX idx_seasonal_rates_property_dates ON public.seasonal_rates(property_id, start_date, end_date);