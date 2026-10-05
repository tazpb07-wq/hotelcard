// End-to-end test of the guest (no-login) reservation flow against the
// live Supabase project, using only the anon key — exactly like a real
// customer device would.
//
//   node scripts/test-guest-flow.mjs
//
// Requires migration 20260221000000_guest_reservation_access.sql applied.
// Leaves a test reservation (status=cancelada, notes=TESTE) — delete it
// in the admin panel afterwards.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

let failures = 0;
const step = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

// 0. Need a real property to attach the reservation to
const { data: prop, error: propErr } = await supabase
  .from("properties")
  .select("id, price_per_night")
  .limit(1)
  .maybeSingle();
step("fetch a property (anon SELECT)", !propErr && !!prop, propErr?.message ?? prop?.id);
if (!prop) process.exit(1);

// 1. Guest creates a reservation — no auth, user_id = null
const today = new Date();
const d = (n) => new Date(today.getTime() + n * 86400000).toISOString().slice(0, 10);
const { data: inserted, error: insErr } = await supabase
  .from("reservations")
  .insert({
    user_id: null,
    property_id: prop.id,
    check_in: d(30),
    check_out: d(32),
    guests: 2,
    total_price: 200,
    price_per_night: 100,
    original_price: 200,
    guest_name: "TESTE FLUXO CONVIDADO",
    notes: "TESTE — pode apagar",
    status: "pendente",
  })
  .select("id")
  .single();
step("guest INSERT reservation (anon)", !insErr && !!inserted?.id, insErr?.message ?? inserted?.id);
if (!inserted) {
  console.log("\n>>> INSERT bloqueado: a migration ainda não foi aplicada no banco.");
  process.exit(1);
}
const rid = inserted.id;

// 2. Guest reads ONLY their reservation via the UUID-gated RPC
const { data: rows, error: rpcErr } = await supabase.rpc("get_guest_reservations", {
  p_ids: [rid],
});
step(
  "RPC get_guest_reservations returns the reservation",
  !rpcErr && rows?.length === 1 && rows[0].id === rid,
  rpcErr?.message ?? `status=${rows?.[0]?.status}`
);

// 2b. RPC must NOT leak other people's reservations
const { data: strangers } = await supabase.rpc("get_guest_reservations", {
  p_ids: ["00000000-0000-0000-0000-000000000000"],
});
step("RPC returns nothing for unknown UUID", Array.isArray(strangers) && strangers.length === 0);

// 2c. Direct table SELECT must return nothing for anon (no data leak)
const { data: direct } = await supabase.from("reservations").select("id").eq("id", rid);
step("anon direct SELECT on reservations returns 0 rows", (direct ?? []).length === 0);

// 3. Admin sets "Pagamento por Aproximação" — simulated by inserting the
//    state directly (anon can only UPDATE status; pix_method is set at insert)
//    → verify a fresh reservation in that state resolves correctly.
const { error: updErr } = await supabase
  .from("reservations")
  .update({ status: "aguardando_pix" })
  .eq("id", rid);
step("anon UPDATE status (guest row)", !updErr, updErr?.message);

// status-only column grant: pix_message must NOT be updatable by anon
const { error: hackErr } = await supabase
  .from("reservations")
  .update({ pix_message: "hackeado" })
  .eq("id", rid);
step("anon cannot UPDATE pix_message (column grant)", !!hackErr);

// 4. Create a second reservation already in the approximation state
//    (what the admin button produces: aguardando_pagamento + marker)
const { data: aprox, error: aproxErr } = await supabase
  .from("reservations")
  .insert({
    user_id: null,
    property_id: prop.id,
    check_in: d(30),
    check_out: d(32),
    guests: 2,
    total_price: 200,
    price_per_night: 100,
    guest_name: "TESTE APROXIMACAO",
    notes: "TESTE — pode apagar",
    status: "aguardando_pagamento",
    pix_method: "copiar_colar",
    pix_message: "__aproximacao__",
  })
  .select("id")
  .single();
step("reservation in aproximação state readable", !aproxErr && !!aprox?.id, aproxErr?.message ?? aprox?.id);

if (aprox?.id) {
  const { data: arows } = await supabase.rpc("get_guest_reservations", { p_ids: [aprox.id] });
  const eff =
    arows?.[0]?.status === "aguardando_pagamento" && arows?.[0]?.pix_message === "__aproximacao__";
  step(
    "RPC exposes aproximação marker (effective status = pagamento_aproximacao → /pagamento-aproximacao/:id)",
    eff,
    `status=${arows?.[0]?.status} pix_message=${arows?.[0]?.pix_message}`
  );
  // leave it visible-but-harmless
  await supabase.from("reservations").update({ status: "cancelada" }).eq("id", aprox.id);
}

// 5. Guest controls RPC (used by /controle/:id)
const { data: controls, error: ctlErr } = await supabase.rpc("get_guest_controls", {
  p_reservation_id: rid,
});
step("RPC get_guest_controls creates+returns row", !ctlErr && !!controls?.id, ctlErr?.message);

const { data: upd, error: updCtlErr } = await supabase.rpc("update_guest_controls", {
  p_reservation_id: rid,
  p_patch: { ac_on: true, ac_temperature: 21, lights_on: true },
});
step(
  "RPC update_guest_controls applies whitelisted patch",
  !updCtlErr && upd?.ac_on === true && upd?.ac_temperature === 21,
  updCtlErr?.message ?? JSON.stringify({ ac_on: upd?.ac_on, temp: upd?.ac_temperature })
);

const { data: badCtl } = await supabase.rpc("get_guest_controls", {
  p_reservation_id: "00000000-0000-0000-0000-000000000000",
});
step("controls RPC refuses unknown reservation", badCtl === null);

// 6. Audit log insert (device fingerprint, used on reservation create)
const { error: auditErr } = await supabase.from("audit_logs").insert({
  action: "reservation_created",
  user_id: null,
  metadata: { reservation_id: rid, device_session: "test-script", user_agent: "node" },
});
step("anon audit_logs insert (reservation_created)", !auditErr, auditErr?.message);

// 7. Cleanup: cancel the test reservation (anon UPDATE status allowed)
await supabase.from("reservations").update({ status: "cancelada" }).eq("id", rid);

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"} — reserva de teste: ${rid} (cancelada; apague no admin)`);
process.exit(failures === 0 ? 0 : 1);
