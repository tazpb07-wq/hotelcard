-- Guests create reservations without an account, but PostgREST's
-- INSERT ... RETURNING (used by supabase-js .select()) requires a SELECT
-- policy that would leak guest PII. This SECURITY DEFINER RPC inserts the
-- row (respecting user_id = auth.uid() for logged-in users, NULL for
-- guests) and returns only the new reservation id.
CREATE OR REPLACE FUNCTION public.create_guest_reservation(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.reservations (
    user_id,
    property_id,
    check_in,
    check_out,
    guests,
    total_price,
    price_per_night,
    original_price,
    status,
    guest_name,
    guest_cpf,
    guest_phone,
    guest_email,
    guest_address,
    guest_number,
    guest_cep,
    price_breakdown
  )
  VALUES (
    auth.uid(),
    (p->>'property_id')::uuid,
    (p->>'check_in')::date,
    (p->>'check_out')::date,
    (p->>'guests')::integer,
    (p->>'total_price')::numeric,
    (p->>'price_per_night')::numeric,
    (p->>'original_price')::numeric,
    'pendente',
    p->>'guest_name',
    p->>'guest_cpf',
    p->>'guest_phone',
    p->>'guest_email',
    p->>'guest_address',
    p->>'guest_number',
    p->>'guest_cep',
    p->'price_breakdown'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_guest_reservation(jsonb) TO anon, authenticated;
