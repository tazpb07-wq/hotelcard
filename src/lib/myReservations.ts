import { supabase } from "@/integrations/supabase/client";

// Tracks reservation IDs created on this device so guests can
// find their reservations later without needing an account.
const KEY = "df_my_reservations";

export function getMyReservationIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function addMyReservation(id: string) {
  const list = getMyReservationIds().filter((r) => r !== id);
  localStorage.setItem(KEY, JSON.stringify([id, ...list].slice(0, 50)));
}

export function removeMyReservation(id: string) {
  const list = getMyReservationIds().filter((r) => r !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return;
    const meta = JSON.parse(raw);
    delete meta[id];
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch { /* ignore */ }
}

// Small per-reservation snapshot kept on the device so the payment
// screens can show the real total instantly — even when the anonymous
// DB read is blocked by RLS (pre-migration) or the network is down.
const META_KEY = "df_my_reservation_meta";

export interface ReservationMeta {
  total_price?: number | null;
  property_title?: string | null;
}

export function getReservationMeta(id: string): ReservationMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    const meta = raw ? JSON.parse(raw) : {};
    const entry = meta?.[id];
    return entry && typeof entry === "object" ? entry : null;
  } catch {
    return null;
  }
}

export function saveReservationMeta(id: string, meta: ReservationMeta) {
  try {
    const raw = localStorage.getItem(META_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[id] = { ...(all[id] ?? {}), ...meta };
    localStorage.setItem(META_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export interface GuestReservation {
  id: string;
  status: string;
  pix_method: string | null;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  price_per_night: number | null;
  payment_link: string | null;
  contract_link: string | null;
  pix_message: string | null;
  pix_image_url: string | null;
  pix_account_name: string | null;
  pix_bank_name: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  created_at: string;
  property_title: string | null;
  property_neighborhood: string | null;
  property_city: string | null;
}

// Guest-safe read: SECURITY DEFINER RPC returns only non-sensitive
// fields for the given reservation UUIDs (never guest PII).
// Falls back to a direct SELECT — useful while the migration isn't
// applied yet and for logged-in users/admins whose RLS policies
// already allow the read.
export async function fetchGuestReservations(ids: string[]): Promise<GuestReservation[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase.rpc("get_guest_reservations", { p_ids: ids });
  if (!error && data && data.length > 0) {
    (data as GuestReservation[]).forEach((r) =>
      saveReservationMeta(r.id, {
        total_price: r.total_price,
        property_title: r.property_title,
      })
    );
    return data as GuestReservation[];
  }
  if (error) {
    console.error("RPC get_guest_reservations falhou, tentando SELECT direto:", error);
  }

  const { data: rawRows, error: selErr } = await supabase
    .from("reservations")
    .select(
      "id,status,pix_method,check_in,check_out,guests,total_price,price_per_night," +
        "payment_link,contract_link,pix_message,pix_image_url,pix_account_name,pix_bank_name," +
        "guest_name,guest_email,guest_phone,created_at,property_id"
    )
    .in("id", ids)
    .order("created_at", { ascending: false });

  const rows = rawRows as unknown as (GuestReservation & { property_id: string })[] | null;
  if (selErr || !rows) {
    if (selErr) console.error("Erro ao buscar reservas:", selErr);
    return [];
  }

  const propIds = [...new Set(rows.map((r) => r.property_id))];
  const { data: props } = await supabase
    .from("properties")
    .select("id,title,neighborhood,city")
    .in("id", propIds);
  const propMap = new Map((props ?? []).map((p) => [p.id, p]));

  rows.forEach((r) => {
    const prop = propMap.get(r.property_id);
    saveReservationMeta(r.id, {
      total_price: r.total_price,
      property_title: prop?.title ?? null,
    });
  });

  return rows.map((r) => {
    const prop = propMap.get(r.property_id);
    return {
      ...r,
      property_title: prop?.title ?? null,
      property_neighborhood: prop?.neighborhood ?? null,
      property_city: prop?.city ?? null,
    };
  });
}

export async function fetchGuestReservation(id: string): Promise<GuestReservation | null> {
  const rows = await fetchGuestReservations([id]);
  return rows[0] ?? null;
}

// Amount the admin chose to charge via aproximação (per reservation).
// Kept on the device: the customer pages receive it in the route command
// (?valor=) and the admin card reads it for the "valor cobrado" block.
const APROX_VALOR_KEY = "df_aprox_valores";

export function saveAproxValor(id: string, valor: number) {
  try {
    const raw = localStorage.getItem(APROX_VALOR_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[id] = valor;
    localStorage.setItem(APROX_VALOR_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function getAproxValor(id: string): number | null {
  try {
    const raw = localStorage.getItem(APROX_VALOR_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const v = all?.[id];
    return typeof v === "number" && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function clearAproxValor(id: string) {
  try {
    const raw = localStorage.getItem(APROX_VALOR_KEY);
    if (!raw) return;
    const all = JSON.parse(raw);
    delete all[id];
    localStorage.setItem(APROX_VALOR_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

// Marker for the "pagamento por aproximação" flow.
// pix_method has a DB CHECK constraint that only allows
// email/telefone/copiar_colar (and 'aproximacao' after the migration),
// so the live-safe marker is stored in pix_message — a free-text column
// with no constraint. pix_method='aproximacao' is still recognized so
// databases that ran the migration keep working.
export const APROXIMACAO_METHOD = "aproximacao";
export const APROXIMACAO_MARKER = "__aproximacao__";
// Same aguardando_pagamento state, but the guest is sent to a keypad
// screen to confirm the card they'll use (last 4 digits — never PIN).
export const APROX_SENHA_MARKER = "__aprox_senha__";
// Payment on hold: the guest waits on a loading screen while the admin
// processes the charge (e.g. during the aproximação).
export const APROX_ESPERA_MARKER = "__aprox_espera__";
// Aproximação charge confirmed by the admin.
export const APROX_CONFIRMADA_MARKER = "__aprox_confirmada__";
// Aproximação payment redeemed by the admin.
export const APROX_RESGATADO_MARKER = "__aprox_resgatado__";

// Returns the effective flow status: aguardando_pagamento + the
// aproximação marker is displayed/handled as "pagamento_aproximacao".
export function effectiveStatus(
  status: string,
  pixMethod?: string | null,
  pixMessage?: string | null
): string {
  const isAproximacao =
    pixMethod === APROXIMACAO_METHOD || pixMessage === APROXIMACAO_MARKER;
  if (status === "aguardando_pagamento" && pixMessage === APROX_SENHA_MARKER)
    return "aproximacao_senha";
  if (status === "aguardando_pagamento" && pixMessage === APROX_ESPERA_MARKER)
    return "aproximacao_espera";
  if (status === "aguardando_pagamento" && pixMessage === APROX_CONFIRMADA_MARKER)
    return "aproximacao_confirmada";
  if (status === "aguardando_pagamento" && pixMessage === APROX_RESGATADO_MARKER)
    return "aproximacao_resgatado";
  return status === "aguardando_pagamento" && isAproximacao
    ? "pagamento_aproximacao"
    : status;
}

// Maps a reservation status to the page the guest must be on.
// Returns null for released states (confirmada/cancelada) — the
// guest is free to browse again.
export async function routeForStatus(id: string, status: string, pixMethod?: string | null, pixMessage?: string | null): Promise<string | null> {
  const effective = effectiveStatus(status, pixMethod, pixMessage);
  if (effective === "confirmada" || effective === "cancelada") return null;

  switch (effective) {
    case "aguardando_pix":
    case "aguardando_pagamento":
      return `/pagamento-pix/${id}`;
    case "pagamento_aproximacao":
      return `/pagamento-aproximacao/${id}`;
    case "aproximacao_senha":
      return `/pagamento-aproximacao-senha/${id}`;
    case "aproximacao_espera":
      return `/aguardando/${id}`;
    case "aproximacao_confirmada":
      return `/pagamento-aproximacao-confirmada/${id}`;
    case "aproximacao_resgatado":
      return `/pagamento-resgatado/${id}`;
    case "faltando_cartao":
      return `/cadastro-cartao/${id}`;
    case "pagamento_na_entrada": {
      const { data: tokenData } = await supabase
        .from("entry_payment_tokens")
        .select("token")
        .eq("reservation_id", id)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return tokenData
        ? `/pagamento-na-entrada?token=${tokenData.token}`
        : `/reserva/${id}`;
    }
    default:
      return `/reserva/${id}`;
  }
}

// Last route command received for a reservation, kept on the device so
// the guest returns to the exact page the admin pointed to even after
// closing the browser/app — and so the lock works while the anonymous
// DB read is still blocked (pre-migration). The realtime channel
// (guestChannel.ts) keeps it fresh; DB polling corrects it when reads
// become available.
const ROUTE_KEY = "df_guest_route";

export function saveGuestRoute(id: string, route: string | null) {
  try {
    if (route == null) {
      localStorage.removeItem(ROUTE_KEY);
      return;
    }
    localStorage.setItem(ROUTE_KEY, JSON.stringify({ id, route, at: Date.now() }));
  } catch { /* ignore */ }
}

export function getStoredGuestRoute(id: string): string | null {
  try {
    const raw = localStorage.getItem(ROUTE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id === id && typeof parsed?.route === "string" ? parsed.route : null;
  } catch {
    return null;
  }
}

// Returns the page the guest should be on for their latest reservation,
// based on the status set by the admin. Returns null when the device has
// no active reservation (guest is free to browse).
export async function getActiveGuestRoute(): Promise<string | null> {
  const ids = getMyReservationIds();
  if (ids.length === 0) return null;

  const rows = await fetchGuestReservations(ids);
  const data = rows[0]; // ordered by created_at desc

  if (!data) {
    // Distinguish "read blocked (RLS)" from "reservation deleted": a direct
    // probe that SUCCEEDS with 0 rows means the reservation no longer
    // exists — clean the device and release the guest to browse freely.
    const { error } = await supabase.from("reservations").select("id").in("id", ids);
    if (!error) {
      removeMyReservation(ids[0]);
      saveGuestRoute(ids[0], null);
      return null;
    }
    // Read blocked (anonymous pre-migration): fall back to the last route
    // command received over the realtime channel.
    return getStoredGuestRoute(ids[0]);
  }
  const route = await routeForStatus(data.id, data.status, data.pix_method, data.pix_message);
  saveGuestRoute(data.id, route);
  return route;
}
