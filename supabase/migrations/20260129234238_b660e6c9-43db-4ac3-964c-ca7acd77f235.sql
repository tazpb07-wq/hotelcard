-- Update default door access code to 0000
ALTER TABLE public.reservation_controls 
ALTER COLUMN door_access_code SET DEFAULT '0000';