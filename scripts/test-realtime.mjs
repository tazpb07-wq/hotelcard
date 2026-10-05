// Validates the realtime broadcast transport used by the aproximação
// flow, with the anon key only — exactly like the real admin/guest
// browsers. Tests BOTH directions:
//   admin → guest : route command
//   guest → admin : card_digits reply
//
//   node scripts/test-realtime.mjs
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

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const TOPIC = `reserva:11111111-1111-1111-1111-111111111111`; // arbitrary — channels need no row
const ADMIN_TOPIC = "admin:card_digits"; // global digits topic (new path)

const admin = createClient(url, key);
const guest = createClient(url, key);

let failures = 0;
const step = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

// ── guest listens ──────────────────────────────────────────────
let guestGot = null;
let adminGot = null;

const gch = guest.channel(TOPIC);
gch.on("broadcast", { event: "cmd" }, ({ payload }) => { guestGot = payload; });
gch.subscribe((status) => {
  if (status !== "SUBSCRIBED") return;
  console.log("guest channel: SUBSCRIBED");

  // ── admin listens + sends ────────────────────────────────────
  const ach = admin.channel(TOPIC);
  ach.on("broadcast", { event: "cmd" }, ({ payload }) => { adminGot = payload; });
  ach.subscribe(async (status) => {
    if (status !== "SUBSCRIBED") return;
    console.log("admin channel: SUBSCRIBED");

    // admin → guest
    const r1 = await ach.send({
      type: "broadcast",
      event: "cmd",
      payload: { type: "route", route: "/pagamento-aproximacao-senha/teste" },
    });
    console.log("admin send route →", r1);
  });
});

// ── global digits topic: guest → any admin page ────────────────
let adminTopicGot = null;
const atch = admin.channel(ADMIN_TOPIC);
atch.on("broadcast", { event: "cmd" }, ({ payload }) => { adminTopicGot = payload; });
atch.subscribe(async (status) => {
  if (status !== "SUBSCRIBED") return;
  console.log("admin digits topic: SUBSCRIBED");
  const gch2 = guest.channel(ADMIN_TOPIC);
  gch2.subscribe(async (status) => {
    if (status !== "SUBSCRIBED") return;
    const r = await gch2.send({
      type: "broadcast",
      event: "cmd",
      payload: { type: "card_digits", digits: "1234", reservation_id: "9e19e049" },
    });
    console.log("guest send digits (admin topic) →", r);
  });
});

setTimeout(() => {
  step("admin → guest: route command received", guestGot?.type === "route", JSON.stringify(guestGot));
  step("admin topic: card_digits received", adminTopicGot?.type === "card_digits", JSON.stringify(adminTopicGot));
  console.log(failures === 0 ? "\nREALTIME OK" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}, 8000);
