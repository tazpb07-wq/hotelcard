// Realtime health + minimal delivery probe
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

// 1. Health endpoint
const health = await fetch(`${env.VITE_SUPABASE_URL}/realtime/v1/health`, {
  headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY },
});
console.log("realtime health:", health.status, await health.text().catch(() => ""));

// 2. Minimal same-socket-pair delivery probe (retry x3)
for (let attempt = 1; attempt <= 3; attempt++) {
  const got = await new Promise((resolve) => {
    const a = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
    const b = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
    const topic = `probe:${Date.now()}`;
    let received = null;
    const chA = a.channel(topic);
    chA.on("broadcast", { event: "x" }, ({ payload }) => { received = payload; });
    chA.subscribe((s) => {
      if (s !== "SUBSCRIBED") return;
      const chB = b.channel(topic);
      chB.subscribe(async (s) => {
        if (s !== "SUBSCRIBED") return;
        await chB.send({ type: "broadcast", event: "x", payload: { n: attempt } });
      });
    });
    setTimeout(() => resolve(received), 4000);
  });
  console.log(`delivery attempt ${attempt}:`, got ? `RECEIVED ${JSON.stringify(got)}` : "NOTHING");
  if (got) break;
  await new Promise((r) => setTimeout(r, 2000));
}
process.exit(0);
