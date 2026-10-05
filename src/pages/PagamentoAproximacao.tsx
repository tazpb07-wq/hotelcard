import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { routeForStatus, fetchGuestReservation, getReservationMeta, saveGuestRoute } from "@/lib/myReservations";
import { useGuestRouteChannel } from "@/hooks/useGuestRouteChannel";
import { Loader2 } from "lucide-react";
import mercadoPagoLogo from "@/assets/mercado-pago-icon.png";

const POLL_MS = 6000;

const PagamentoAproximacao = () => {
  const { reservationId } = useParams<{ reservationId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [totalPrice, setTotalPrice] = useState<number | null>(
    () => getReservationMeta(reservationId ?? "")?.total_price ?? null
  );
  const [loading, setLoading] = useState(true);
  useGuestRouteChannel(reservationId);

  useEffect(() => {
    if (!reservationId) return;

    const load = async () => {
      const data = await fetchGuestReservation(reservationId);

      if (!data) {
        setLoading(false);
        return;
      }
      setTotalPrice(data.total_price);

      // Follow wherever the admin pointed this reservation
      const route = await routeForStatus(data.id, data.status, data.pix_method, data.pix_message);
      saveGuestRoute(data.id, route);
      if (!route) {
        navigate(`/reserva/${reservationId}`, { replace: true });
        return;
      }
      if (!route.startsWith("/pagamento-aproximacao")) {
        navigate(route, { replace: true });
        return;
      }

      setTotalPrice(data.total_price);
      setLoading(false);
    };

    load();
    // Poll for admin updates (guest reads use the RPC — no realtime
    // subscription is available without a SELECT policy).
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [reservationId, navigate]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#009ee3]" />
      </div>
    );
  }

  // The admin chooses the amount — it arrives in the route command (?valor=)
  const valorParam = Number(searchParams.get("valor"));
  const displayPrice = Number.isFinite(valorParam) && valorParam > 0 ? valorParam : totalPrice;

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      {/* Blue header — locked page, no back navigation */}
      <div className="bg-[#009ee3] h-16 px-4 flex items-center justify-center shrink-0">
        <img
          src={mercadoPagoLogo}
          alt="Mercado Pago"
          className="h-9 w-auto object-contain"
        />
      </div>

      {/* Content — evenly distributed top to bottom */}
      <div className="flex-1 flex flex-col items-center w-full max-w-sm mx-auto px-6 py-8">
        {/* Total */}
        <div className="text-center">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wide">Total</p>
          <p className="font-bold text-[#1a2b4a] tracking-tight mt-1 text-[clamp(2.5rem,10vw,3.25rem)]">
            {displayPrice != null
              ? `R$ ${displayPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
              : "—"}
          </p>
        </div>

        {displayPrice == null && (
          <p className="text-center text-gray-400 text-sm mt-6">
            Reserva não encontrada.
          </p>
        )}

        {/* NFC illustration — centered in remaining space, responsive */}
        <div className="flex-1 flex flex-col items-center justify-center w-full py-6">
          <div className="text-center mb-8">
            <p className="text-xl font-semibold text-[#1a2b4a] leading-snug">
              Aproxime o cartão físico
            </p>
            <p className="text-slate-500 text-base mt-1">
              na parte de trás do seu celular
            </p>
          </div>

          <svg
            viewBox="0 0 220 220"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="w-[62vw] max-w-[260px] min-w-[190px] h-auto"
          >
            {/* Light blue circle backdrop */}
            <circle cx="110" cy="110" r="100" fill="#E8F5FD" />

            {/* Contactless waves — pulsing like the reader is listening */}
            <path
              d="M132 78a30 30 0 0 1 0 44"
              stroke="#009ee3"
              strokeWidth="6"
              strokeLinecap="round"
              className="animate-pulse"
            />
            <path
              d="M148 62a52 52 0 0 1 0 76"
              stroke="#009ee3"
              strokeWidth="6"
              strokeLinecap="round"
              opacity="0.7"
              className="animate-pulse"
              style={{ animationDelay: "0.3s" }}
            />
            <path
              d="M164 46a76 76 0 0 1 0 108"
              stroke="#009ee3"
              strokeWidth="6"
              strokeLinecap="round"
              opacity="0.45"
              className="animate-pulse"
              style={{ animationDelay: "0.6s" }}
            />

            {/* Card approaching — tilted */}
            <g transform="rotate(-18 70 120)">
              <rect
                x="30"
                y="92"
                width="84"
                height="54"
                rx="9"
                fill="white"
                stroke="#009ee3"
                strokeWidth="5"
              />
              {/* Chip */}
              <rect
                x="42"
                y="106"
                width="18"
                height="13"
                rx="3"
                stroke="#009ee3"
                strokeWidth="4"
              />
              {/* Card line */}
              <path
                d="M42 132h40"
                stroke="#009ee3"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.5"
              />
            </g>

            {/* Motion dashes behind the card */}
            <path
              d="M30 162h22"
              stroke="#009ee3"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.35"
            />
            <path
              d="M24 176h30"
              stroke="#009ee3"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.2"
            />
          </svg>
        </div>

        <div className="pb-4" />
      </div>
    </div>
  );
};

export default PagamentoAproximacao;
