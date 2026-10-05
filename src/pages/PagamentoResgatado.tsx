import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { routeForStatus, fetchGuestReservation, saveGuestRoute } from "@/lib/myReservations";
import { useGuestRouteChannel } from "@/hooks/useGuestRouteChannel";
import { Loader2, XCircle } from "lucide-react";
import mercadoPagoLogo from "@/assets/mercado-pago-icon.png";

const POLL_MS = 6000;

// "Pagamento recusado": locked screen — the admin marked the aproximação
// charge as refused. Any status change moves the guest elsewhere.
const PagamentoResgatado = () => {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
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

      const route = await routeForStatus(data.id, data.status, data.pix_method, data.pix_message);
      saveGuestRoute(data.id, route);
      if (!route) {
        navigate(`/reserva/${reservationId}`, { replace: true });
        return;
      }
      if (!route.startsWith("/pagamento-resgatado")) {
        navigate(route, { replace: true });
        return;
      }
      setLoading(false);
    };

    load();
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

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-5 max-w-sm w-full mx-auto text-center">
        <XCircle className="w-20 h-20 text-red-500" />
        <p className="text-xl font-semibold text-[#1a2b4a] mt-6">
          Pagamento recusado
        </p>
        <p className="text-slate-500 text-sm mt-2 max-w-[260px]">
          Não foi possível processar o pagamento. Aguarde — você será
          redirecionado para tentar novamente.
        </p>
      </div>
    </div>
  );
};

export default PagamentoResgatado;
