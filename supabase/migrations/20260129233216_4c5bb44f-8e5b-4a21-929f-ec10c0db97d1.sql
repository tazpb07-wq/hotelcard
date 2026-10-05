-- Update default door access code to 1234
ALTER TABLE public.reservation_controls 
ALTER COLUMN door_access_code SET DEFAULT '1234';