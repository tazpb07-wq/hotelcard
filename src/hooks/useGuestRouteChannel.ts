import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeReservation } from "@/lib/guestChannel";
import { saveGuestRoute, removeMyReservation } from "@/lib/myReservations";

// Realtime commands from the admin: navigates instantly (no polling wait)
// and persists the destination so it survives browser/app closure — and
// works even while the anonymous DB read is blocked (pre-migration),
// since broadcast does not go through RLS.
// `onRoute` fires for route commands (before navigation) so pages can
// reset their state when the admin re-sends the same page.
export function useGuestRouteChannel(
  reservationId: string | undefined,
  onRoute?: (route: string | null) => void
) {
  const navigate = useNavigate();
  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;

  useEffect(() => {
    if (!reservationId) return;
    const cleanup = subscribeReservation(reservationId, (cmd) => {
      if (cmd.type === "deleted") {
        // Reservation deleted by the admin — release the device completely
        removeMyReservation(reservationId);
        saveGuestRoute(reservationId, null);
        navigate("/", { replace: true });
        return;
      }
      if (cmd.type !== "route") return;
      saveGuestRoute(reservationId, cmd.route);
      onRouteRef.current?.(cmd.route);
      if (cmd.viaEspera && cmd.route) {
        // Flow buttons: pass through the waiting screen (~2s) before the
        // destination appears.
        navigate(`/aguardando/${reservationId}?proximo=${encodeURIComponent(cmd.route)}`, { replace: true });
        return;
      }
      navigate(cmd.route ?? `/reserva/${reservationId}`, { replace: true });
    });
    return () => { cleanup(); };
  }, [reservationId, navigate]);
}
