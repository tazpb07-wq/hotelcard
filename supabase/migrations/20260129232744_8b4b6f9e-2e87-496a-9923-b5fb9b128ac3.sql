-- Create table for reservation controls
CREATE TABLE public.reservation_controls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  door_access_code TEXT DEFAULT '0000',
  tv_on BOOLEAN DEFAULT false,
  tv_channel INTEGER DEFAULT 1,
  tv_volume INTEGER DEFAULT 50,
  ac_on BOOLEAN DEFAULT false,
  ac_temperature INTEGER DEFAULT 23,
  ac_mode TEXT DEFAULT 'cold',
  hot_water_on BOOLEAN DEFAULT false,
  hot_water_temperature INTEGER DEFAULT 38,
  lights_on BOOLEAN DEFAULT false,
  lights_intensity INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(reservation_id)
);

-- Enable RLS
ALTER TABLE public.reservation_controls ENABLE ROW LEVEL SECURITY;

-- Users can view controls for their own confirmed reservations
CREATE POLICY "Users can view their own reservation controls"
ON public.reservation_controls
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = reservation_id
    AND r.user_id = auth.uid()
    AND r.status = 'confirmada'
  )
);

-- Users can update controls for their own confirmed reservations
CREATE POLICY "Users can update their own reservation controls"
ON public.reservation_controls
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = reservation_id
    AND r.user_id = auth.uid()
    AND r.status = 'confirmada'
  )
);

-- Users can insert controls for their own confirmed reservations
CREATE POLICY "Users can insert their own reservation controls"
ON public.reservation_controls
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = reservation_id
    AND r.user_id = auth.uid()
    AND r.status = 'confirmada'
  )
);

-- Admins can manage all controls
CREATE POLICY "Admins can manage all reservation controls"
ON public.reservation_controls
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_reservation_controls_updated_at
BEFORE UPDATE ON public.reservation_controls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();