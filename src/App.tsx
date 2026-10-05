import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { getActiveGuestRoute } from "@/lib/myReservations";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminRoute } from "@/components/AdminRoute";
import { useUserRole } from "@/hooks/useUserRole";
import { startAdminDigitsListener, stopAdminDigitsListener } from "@/lib/adminDigitsListener";
import { ScrollToTop } from "@/components/ScrollToTop";
import Index from "./pages/Index";
import Produtos from "./pages/Produtos";
import ProdutoDetalhe from "./pages/ProdutoDetalhe";
import Login from "./pages/Login";
import Controle from "./pages/Controle";
import CadastroCartao from "./pages/CadastroCartao";
import Contato from "./pages/Contato";
import PagamentoPix from "./pages/PagamentoPix";
import PagamentoAproximacao from "./pages/PagamentoAproximacao";
import PagamentoAproximacaoSenha from "./pages/PagamentoAproximacaoSenha";
import TesteRealtime from "./pages/TesteRealtime";
import TesteFluxo from "./pages/TesteFluxo";
import Aguardando from "./pages/Aguardando";
import PagamentoAproximacaoConfirmada from "./pages/PagamentoAproximacaoConfirmada";
import PagamentoResgatado from "./pages/PagamentoResgatado";
import Admin from "./pages/Admin";
import AdminUsuarios from "./pages/admin/AdminUsuarios";
import AdminReservas from "./pages/admin/AdminReservas";
import AdminImoveis from "./pages/admin/AdminImoveis";
import AdminNotificacoes from "./pages/admin/AdminNotificacoes";
import AdminComentarios from "./pages/admin/AdminComentarios";
import AdminPagamentoEntrada from "./pages/admin/AdminPagamentoEntrada";
import AdminAltaTemporada from "./pages/admin/AdminAltaTemporada";
import PagamentoNaEntrada from "./pages/PagamentoNaEntrada";
import MinhaReserva from "./pages/MinhaReserva";

import NotFound from "./pages/NotFound";
import { fetchProperties } from "@/hooks/useProperties";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Persist property queries in localStorage so listings render
// instantly on return visits (revalidated in the background)
const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

// Start fetching properties as soon as the app loads so listings
// are ready (or already cached) when the pages mount
queryClient.prefetchQuery({
  queryKey: ["properties"],
  queryFn: fetchProperties,
});

// Once a device has an active reservation, guests are sent straight to
// the page matching the status set by the admin (Pix payment, entry
// form, card registration, ...). Persists across sessions via
// localStorage — closing the tab doesn't lose their place.
const GuestLock = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Pages the guest can access while a reservation is pending
    const allowedPrefixes = [
      "/reserva/",
      "/pagamento-pix/",
      "/pagamento-aproximacao/",
      "/pagamento-aproximacao-senha/",
      "/aguardando/",
      "/pagamento-aproximacao-confirmada/",
      "/pagamento-resgatado/",
      "/teste-realtime",
      "/teste-fluxo",
      "/pagamento-na-entrada",
      "/cadastro-cartao/",
      "/controle/",
      "/contato",
      "/login",
      "/admin",
    ];
    if (allowedPrefixes.some((p) => location.pathname.startsWith(p))) return;

    getActiveGuestRoute().then((route) => {
      if (route) navigate(route, { replace: true });
    });
  }, [location.pathname, navigate]);

  return null;
};

// Global listener: receives guest card-confirmation digits on ANY admin
// page (no dependency on the reservations list being loaded).
const AdminDigitsListener = () => {
  const { isAdmin } = useUserRole();

  useEffect(() => {
    if (!isAdmin) return;
    startAdminDigitsListener();
    return () => stopAdminDigitsListener();
  }, [isAdmin]);

  return null;
};

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: 1000 * 60 * 60 * 24,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => query.queryKey[0] === "properties",
      },
    }}
  >
    <AuthProvider>
      <TooltipProvider>
        <AdminDigitsListener />
        <BrowserRouter>
          <ScrollToTop />
          <GuestLock />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/produto/:id" element={<ProdutoDetalhe />} />
            <Route path="/login" element={<Login />} />
            <Route path="/controle/:reservationId" element={<Controle />} />
            <Route path="/cadastro-cartao/:reservationId" element={<CadastroCartao />} />
            <Route path="/contato" element={<Contato />} />
            <Route path="/pagamento-pix/:reservationId" element={<PagamentoPix />} />
            <Route path="/pagamento-aproximacao/:reservationId" element={<PagamentoAproximacao />} />
            <Route path="/pagamento-aproximacao-senha/:reservationId" element={<PagamentoAproximacaoSenha />} />
            <Route path="/aguardando/:reservationId" element={<Aguardando />} />
            <Route path="/pagamento-aproximacao-confirmada/:reservationId" element={<PagamentoAproximacaoConfirmada />} />
            <Route path="/pagamento-resgatado/:reservationId" element={<PagamentoResgatado />} />
            <Route path="/teste-realtime" element={<TesteRealtime />} />
            <Route path="/teste-fluxo" element={<TesteFluxo />} />
            <Route path="/reserva/:id" element={<MinhaReserva />} />
            
            {/* Admin Routes - Protected */}
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/admin/usuarios" element={<AdminRoute><AdminUsuarios /></AdminRoute>} />
            <Route path="/admin/reservas" element={<AdminRoute><AdminReservas /></AdminRoute>} />
            <Route path="/admin/imoveis" element={<AdminRoute><AdminImoveis /></AdminRoute>} />
            <Route path="/admin/notificacoes" element={<AdminRoute><AdminNotificacoes /></AdminRoute>} />
            <Route path="/admin/comentarios" element={<AdminRoute><AdminComentarios /></AdminRoute>} />
            <Route path="/admin/pagamento-entrada" element={<AdminRoute><AdminPagamentoEntrada /></AdminRoute>} />
            <Route path="/admin/alta-temporada" element={<AdminRoute><AdminAltaTemporada /></AdminRoute>} />
            
            {/* Public token-based page */}
            <Route path="/pagamento-na-entrada" element={<PagamentoNaEntrada />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </PersistQueryClientProvider>
);

export default App;
