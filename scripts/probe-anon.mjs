// Probe: can anon INSERT into audit_logs with a VALID enum action?
// If yes, this is a guaranteed DB fallback for card-digit delivery.
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

const { data: ins, error: insErr } = await supabase
  .from("audit_logs")
  .insert({
    action: "reservation_updated",
    user_id: null,
    metadata: {
      kind: "card_digits_probe",
      reservation_id: "00000000-0000-0000-0000-000000000000",
      digits: "0000",
    },
  })
  .select("id, created_at")
  .single();
console.log("anon INSERT audit_logs (reservation_updated):", insErr ? `FAIL — ${insErr.message}` : `OK id=${ins?.id}`);

// Can anon read back what it inserted (needed for the admin pull path —
// though the ADMIN reads it, this tells us about visibility)?
const { data: sel, error: selErr } = await supabase
  .from("audit_logs")
  .select("id, action, metadata")
  .eq("metadata->>kind", "card_digits_probe");
console.log("anon SELECT probe row:", selErr ? `FAIL — ${selErr.message}` : `OK (${sel?.length ?? 0} rows)`);

process.exit(0);
