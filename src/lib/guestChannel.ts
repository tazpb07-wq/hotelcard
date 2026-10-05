import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Realtime channels. Broadcast does NOT go through table RLS, so
// admin→guest commands and guest→admin replies work even before the
// guest-access migration is applied (RLS blocks anonymous
// SELECT/UPDATE, not broadcast).
//
// Two topics:
// - `reserva:<uuid>` — unguessable, per-reservation route commands.
// - `admin:card_digits` — guests publish their card-confirmation digits
//   here; any signed-in admin browser receives them on ANY admin page.

export const reservationChannelName = (id: string) => `reserva:${id}`;
export const ADMIN_DIGITS_TOPIC = "admin:card_digits";

export type ReservationCommand =
  | { type: "route"; route: string | null; viaEspera?: boolean } // where the guest must be (null = released); viaEspera = pass through the waiting screen for ~2s first
  | { type: "card_digits"; digits: string; reservation_id: string } // guest → admin
  | { type: "deleted" }; // admin deleted the reservation — guest is released

type Handler = (cmd: ReservationCommand) => void;

interface ChannelState {
  ch: RealtimeChannel;
  handlers: Set<Handler>;
  ready: boolean;
  readyWaiters: Set<() => void>;
}

// One channel per topic per app instance — joining the same topic twice
// from one socket is rejected by the server, so everything shares.
const channels = new Map<string, ChannelState>();

function ensureChannel(name: string): ChannelState {
  const st = channels.get(name);
  if (st) return st;

  const state: ChannelState = {
    ch: supabase.channel(name),
    handlers: new Set(),
    ready: false,
    readyWaiters: new Set(),
  };

  state.ch
    .on("broadcast", { event: "cmd" }, ({ payload }) => {
      const cmd = payload as ReservationCommand;
      if (!cmd) return;
      if (cmd.type === "route" && typeof cmd.route === "string") {
        // ok
      } else if (
        cmd.type === "card_digits" &&
        typeof cmd.digits === "string" &&
        typeof cmd.reservation_id === "string"
      ) {
        // ok
      } else if (cmd.type === "deleted") {
        // ok
      } else {
        return;
      }
      state.handlers.forEach((h) => {
        try { h(cmd); } catch { /* handler error must not kill the channel */ }
      });
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        state.ready = true;
        state.readyWaiters.forEach((w) => w());
        state.readyWaiters.clear();
      }
    });

  channels.set(name, state);
  return state;
}

// Persistent subscription; returns the cleanup function.
export function subscribeTopic(topic: string, handler: Handler) {
  const st = ensureChannel(topic);
  st.handlers.add(handler);
  return () => { st.handlers.delete(handler); };
}

export function subscribeReservation(id: string, handler: Handler) {
  return subscribeTopic(reservationChannelName(id), handler);
}

// Fire-and-forget send: optimistic attempt after 3s, guaranteed attempt
// once the channel is joined (a duplicate is harmless — the admin side
// deduplicates identical digits within a short window).
export function sendOnTopic(topic: string, cmd: ReservationCommand) {
  const st = ensureChannel(topic);
  const send = () => {
    st.ch
      .send({ type: "broadcast", event: "cmd", payload: cmd })
      .catch(() => { /* transport down — DB polling is the fallback */ });
  };
  if (st.ready) {
    send();
    return;
  }
  const timeout = setTimeout(send, 3000);
  st.readyWaiters.add(() => {
    clearTimeout(timeout);
    send();
  });
}

export function sendReservationCommand(id: string, cmd: ReservationCommand) {
  sendOnTopic(reservationChannelName(id), cmd);
}
