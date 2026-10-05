import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { routeForStatus, fetchGuestReservation, saveGuestRoute } from "@/lib/myReservations";
import { useGuestRouteChannel } from "@/hooks/useGuestRouteChannel";
import { Loader2 } from "lucide-react";
import mercadoPagoLogo from "@/assets/mercado-pago-icon.png";

const POLL_MS = 6000;
const ESPERA_MS = 2000;

// "Aguardando": the guest waits on this locked screen (loading loop)
// while the admin processes something — a global wait, not necessarily
// payment-related. Any admin status change moves the guest elsewhere.
// When opened with ?proximo=<route>, it holds for ESPERA_MS and then
// continues to the destination the admin picked.
const Aguardando = () => {
  const { reservationId } = useParams<{ reservationId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const proximo = searchParams.get("proximo");
  useGuestRouteChannel(reservationId);

  useEffect(() => {
    if (!reservationId || proximo) return;

    const load = async () => {
      const data = await fetchGuestReservation(reservationId);
      if (!data) {
        setLoading(false);
        return;
      }

      const route = await routeForStatus(data.id, data.status, data.pix_method, data.pix_message);
      saveGuestRoute(data.id, route);
      if (!route) {
        navigate(`/reserva/${reservationId}`, { replace: true });
        return;
      }
      if (!route.startsWith("/aguardando")) {
        navigate(route, { replace: true });
        return;
      }
      setLoading(false);
    };

    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [reservationId, navigate, proximo]);

  // Continue to the destination after the short hold
  useEffect(() => {
    if (!proximo) return;
    const t = setTimeout(() => navigate(proximo, { replace: true }), ESPERA_MS);
    return () => clearTimeout(t);
  }, [proximo, navigate]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#009ee3]" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      {/* Blue header — locked page, no navigation */}
      <div className="bg-[#009ee3] h-12 relative flex items-center justify-center">
        <img
          src={mercadoPagoLogo}
          alt="Mercado Pago"
          className="h-8 w-auto object-contain"
        />
      </div>

      <div className="flex-1 flex flex-col items-center px-5 py-5 max-w-sm w-full mx-auto text-center">
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* MP-style processing visual: pulsing ripples + spinning ring */}
          <div className="relative w-44 h-44 mb-10 flex items-center justify-center">
            {/* Solid disc + spinning progress ring */}
            <div className="absolute inset-8 rounded-full bg-[#E8F5FD] shadow-inner" />
            <div className="absolute inset-8 rounded-full border-[5px] border-[#009ee3]/15 border-t-[#009ee3] animate-spin" style={{ animationDuration: "1.4s" }} />
          </div>

          <p className="text-xl font-semibold text-[#1a2b4a] tracking-tight">
            Carregando
          </p>
        </div>

        {/* Bottom hint — keeps the guest on the page */}
        <p className="text-slate-400 text-xs pb-4">
          Não feche esta tela
        </p>
      </div>
    </div>
  );
};

export default Aguardando;
