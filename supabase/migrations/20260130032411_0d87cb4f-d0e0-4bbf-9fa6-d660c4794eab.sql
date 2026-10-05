-- Add rooms count and room term columns to reservations
ALTER TABLE public.reservations 
ADD COLUMN rooms integer DEFAULT 1,
ADD COLUMN room_term text DEFAULT 'quartos';

-- Add comment for clarity
COMMENT ON COLUMN public.reservations.rooms IS 'Number of rooms/apartments for this reservation (admin only)';
COMMENT ON COLUMN public.reservations.room_term IS 'Term to display: quartos or apartamentos';