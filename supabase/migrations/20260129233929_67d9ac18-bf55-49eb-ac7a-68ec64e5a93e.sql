-- Update reservation_controls table with new fields
ALTER TABLE public.reservation_controls 
ADD COLUMN IF NOT EXISTS ac_turbo_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ac_eco_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS water_temp_mode TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS lights_bedroom_on BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lights_bedroom_intensity INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS lights_bathroom_on BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lights_bathroom_intensity INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS lights_kitchen_on BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lights_kitchen_intensity INTEGER DEFAULT 100;