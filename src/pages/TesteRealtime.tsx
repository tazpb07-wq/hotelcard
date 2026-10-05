import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_DIGITS_TOPIC, reservationChannelName } from "@/lib/guestChannel";
import { Button } from "@/components/ui/button";

// One-click diagnostic for the realtime transport used by the
// aproximação/senha flow — runs in the REAL browser with the app's own
// Supabase project. A second client simulates the other side (admin or
// guest) since a connection never receives its own broadcasts.
const guestClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

type Result = { name: string; ok: boolean | null; detail?: string };

const TesteRealtime = () => {
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setResults([
      { name: "Conexão realtime (tópico admin:card_digits)", ok: null },
      { name: "Cliente → Admin: dígitos recebidos", ok: null },
      { name: "Admin → Cliente: comando de rota recebido", ok: null },
    ]);
    const setRes = (i: number, ok: boolean, detail?: string) =>
      setResults((prev) => prev.map((r, j) => (j === i ? { ...r, ok, detail } : r)));

    const testId = "11111111-1111-1111-1111-111111111111";
    let adminGotDigits: unknown = null;
    let guestGotRoute: unknown = null;

    // "Admin" side on the app's own client
    const adminCh = supabase.channel(ADMIN_DIGITS_TOPIC);
    adminCh
      .on("broadcast", { event: "cmd" }, ({ payload }) => { adminGotDigits = payload; })
      .subscribe();

    const adminReservaCh = supabase.channel(reservationChannelName(testId));
    adminReservaCh
      .on("broadcast", { event: "cmd" }, ({ payload }) => { guestGotRoute = payload; })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // "Guest" side on a second client (own connection)
        const guestCh = guestClient.channel(ADMIN_DIGITS_TOPIC);
        guestCh.subscribe((s) => {
          if (s !== "SUBSCRIBED") return;
          guestCh
            .send({
              type: "broadcast",
              event: "cmd",
              payload: { type: "card_digits", digits: "1234", reservation_id: testId },
            })
            .catch(() => {});
        });
        const guestReservaCh = guestClient.channel(reservationChannelName(testId));
        guestReservaCh.subscribe((s) => {
          if (s !== "SUBSCRIBED") return;
          guestReservaCh
            .send({
              type: "broadcast",
              event: "cmd",
              payload: { type: "route", route: "/pagamento-aproximacao-senha/teste" },
            })
            .catch(() => {});
        });
      });

    const started = Date.now();
    const tick = setInterval(() => {
      if (adminGotDigits) setRes(1, true, JSON.stringify(adminGotDigits));
      if (guestGotRoute) setRes(2, true, JSON.stringify(guestGotRoute));
      if (adminGotDigits && guestGotRoute) {
        setRes(0, true, "canal conectado e entregando");
        clearInterval(tick);
        setRunning(false);
      } else if (Date.now() - started > 8000) {
        setRes(0, false, "sem conexão em 8s — Realtime bloqueado nesta rede/aba");
        if (!adminGotDigits) setRes(1, false, "nada recebido");
        if (!guestGotRoute) setRes(2, false, "nada recebido");
        clearInterval(tick);
        setRunning(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-5">
        <h1 className="text-lg font-semibold text-[#1a2b4a]">Teste de conexão em tempo real</h1>
        <p className="text-sm text-slate-500 mt-1">
          Valida o canal usado para enviar os dígitos do cliente ao admin.
        </p>
        <Button onClick={run} disabled={running} className="w-full mt-4 bg-[#009ee3] hover:bg-[#0089c7]">
          {running ? "Testando..." : "Rodar teste"}
        </Button>
        <div className="mt-4 space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-sm rounded-lg border px-3 py-2"
            >
              <span>
                {r.ok === null ? "⏳" : r.ok ? "✅" : "❌"}
              </span>
              <div>
                <p className="font-medium text-[#1a2b4a]">{r.name}</p>
                {r.detail && <p className="text-xs text-slate-500 break-all">{r.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TesteRealtime;
