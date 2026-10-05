import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { routeForStatus, effectiveStatus, fetchGuestReservation, saveGuestRoute, GuestReservation } from "@/lib/myReservations";
import { useGuestRouteChannel } from "@/hooks/useGuestRouteChannel";
import {
  Loader2,
  Calendar,
  Users,
  MapPin,
  MessageCircle,
  QrCode,
  ClipboardList,
  CreditCard,
  FileSignature,
  KeyRound,
  Clock,
  CheckCircle,
  XCircle,
  Nfc,
} from "lucide-react";

interface ReservationRow extends GuestReservation {
  property: { title: string; neighborhood: string | null; city: string } | null;
}

const statusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pendente: { label: "Aguardando confirmação", className: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
  aguardando_pix: { label: "Aguardando pagamento Pix", className: "bg-teal-100 text-teal-800 border-teal-200", icon: QrCode },
  aguardando_pagamento: { label: "Aguardando pagamento", className: "bg-teal-100 text-teal-800 border-teal-200", icon: QrCode },
  pagamento_na_entrada: { label: "Pagamento na entrada", className: "bg-blue-100 text-blue-800 border-blue-200", icon: ClipboardList },
  faltando_cartao: { label: "Cadastro de cartão pendente", className: "bg-purple-100 text-purple-800 border-purple-200", icon: CreditCard },
  aguardando_assinatura: { label: "Aguardando assinatura", className: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: FileSignature },
  pagamento_aproximacao: { label: "Pagamento por aproximação", className: "bg-cyan-100 text-cyan-800 border-cyan-200", icon: Nfc },
  aproximacao_senha: { label: "Confirmar cartão", className: "bg-sky-100 text-sky-800 border-sky-200", icon: CreditCard },
  confirmada: { label: "Reserva confirmada", className: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  cancelada: { label: "Reserva cancelada", className: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
};

const formatDateBR = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");

const MinhaReserva = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState<ReservationRow | null>(null);
  const [entryToken, setEntryToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [live, setLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  useGuestRouteChannel(id);

  useEffect(() => {
    if (!id) return;

    const load = async (initial = false) => {
      const data = await fetchGuestReservation(id);

      if (!data) {
        if (initial) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      const eff = effectiveStatus(data.status, data.pix_method, data.pix_message);

      // If the admin pointed this reservation to an action page, go
      // straight there — the guest stays on the aba they were given.
      const target = await routeForStatus(data.id, data.status, data.pix_method, data.pix_message);
      saveGuestRoute(data.id, target);
      if (target && target !== `/reserva/${data.id}`) {
        navigate(target, { replace: true });
        return;
      }

      if (!initial && prevStatusRef.current && prevStatusRef.current !== eff) {
        toast.success("Sua reserva foi atualizada pelo anfitrião!");
        setLastUpdate(new Date());
      }
      prevStatusRef.current = eff;

      setNotFound(false);
      setReservation({
        ...data,
        property: data.property_title
          ? { title: data.property_title, neighborhood: data.property_neighborhood, city: data.property_city ?? "" }
          : null,
      });

      if (data.status === "pagamento_na_entrada") {
        const { data: tokenData } = await supabase
          .from("entry_payment_tokens")
          .select("token")
          .eq("reservation_id", id)
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setEntryToken(tokenData?.token ?? null);
      } else {
        setEntryToken(null);
      }

      setLoading(false);
      setLive(true);
    };

    load(true);
    // Poll every 6s — anonymous reads go through the guest RPC (no RLS
    // SELECT), so realtime channels aren't available; polling keeps the
    // page updated seconds after the admin acts.
    const interval = setInterval(() => load(), 6000);
    return () => clearInterval(interval);
  }, [id, navigate]);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (notFound || !reservation) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Reserva não encontrada.</p>
            <p className="text-sm text-muted-foreground">
              Se você acabou de reservar, fale com a gente que localizamos para você.
            </p>
            <Button variant="gold" asChild>
              <a href="https://wa.me/5583987344520" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4 mr-2" />
                Falar no WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const effStatus = effectiveStatus(reservation.status, reservation.pix_method, reservation.pix_message);
  const status = statusConfig[effStatus] ?? statusConfig.pendente;
  const StatusIcon = status.icon;
  // Guest stays on this page until the admin confirms or cancels
  const locked = reservation.status !== "confirmada" && reservation.status !== "cancelada";

  const whatsappUrl = `https://wa.me/5583987344520?text=${encodeURIComponent(
    `Olá! Gostaria de informações sobre minha reserva no ${reservation.property?.title ?? "imóvel"}.`
  )}`;

  return (
    <Layout locked={locked}>
      <div className="bg-secondary flex-1 py-6 md:py-10">
        <div className="container mx-auto px-4 max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              {reservation.guest_name
                ? `Olá, ${reservation.guest_name.split(" ")[0]} — sua reserva`
                : "Sua reserva"}
            </span>
            {live && (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Ao vivo
              </span>
            )}
          </div>

          {/* Property + status */}
          <Card className="overflow-hidden">
            <div className="p-5 border-b border-border/60 space-y-2.5">
              <Badge variant="outline" className={`${status.className} whitespace-nowrap`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground leading-tight">
                  {reservation.property?.title}
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  {reservation.property?.neighborhood}, {reservation.property?.city}
                </p>
              </div>
            </div>

            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3" /> Check-in
                  </p>
                  <p className="font-semibold">{formatDateBR(reservation.check_in)}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3" /> Check-out
                  </p>
                  <p className="font-semibold">{formatDateBR(reservation.check_out)}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Users className="w-3 h-3" /> Hóspedes
                  </p>
                  <p className="font-semibold">{reservation.guests}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Total</p>
                  <p className="font-semibold text-primary">
                    R$ {reservation.total_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {(reservation.guest_name || reservation.guest_phone || reservation.guest_email) && (
                <div className="rounded-lg border border-border/60 p-3 space-y-1 text-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Dados do hóspede
                  </p>
                  {reservation.guest_name && (
                    <p className="font-medium">{reservation.guest_name}</p>
                  )}
                  {reservation.guest_phone && (
                    <p className="text-muted-foreground">{reservation.guest_phone}</p>
                  )}
                  {reservation.guest_email && (
                    <p className="text-muted-foreground break-all">{reservation.guest_email}</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-2">
                {(effStatus === "aguardando_pix" ||
                  effStatus === "aguardando_pagamento") && (
                  <Button variant="gold" size="lg" className="w-full" asChild>
                    <Link to={`/pagamento-pix/${reservation.id}`}>
                      <QrCode className="w-4 h-4 mr-2" />
                      Pagar com Pix
                    </Link>
                  </Button>
                )}

                {reservation.status === "pagamento_na_entrada" && entryToken && (
                  <Button variant="gold" size="lg" className="w-full" asChild>
                    <Link to={`/pagamento-na-entrada?token=${entryToken}`}>
                      <ClipboardList className="w-4 h-4 mr-2" />
                      Preencher dados da entrada
                    </Link>
                  </Button>
                )}

                {effStatus === "pagamento_aproximacao" && (
                  <Button variant="gold" size="lg" className="w-full" asChild>
                    <Link to={`/pagamento-aproximacao/${reservation.id}`}>
                      <Nfc className="w-4 h-4 mr-2" />
                      Ver pagamento por aproximação
                    </Link>
                  </Button>
                )}

                {reservation.status === "faltando_cartao" && (
                  <Button variant="gold" size="lg" className="w-full" asChild>
                    <Link to={`/cadastro-cartao/${reservation.id}`}>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Cadastrar cartão
                    </Link>
                  </Button>
                )}

                {reservation.status === "aguardando_assinatura" && reservation.contract_link && (
                  <Button variant="gold" size="lg" className="w-full" asChild>
                    <a href={reservation.contract_link} target="_blank" rel="noopener noreferrer">
                      <FileSignature className="w-4 h-4 mr-2" />
                      Assinar contrato
                    </a>
                  </Button>
                )}

                {reservation.status === "confirmada" && (
                  <Button variant="gold" size="lg" className="w-full" asChild>
                    <Link to={`/controle/${reservation.id}`}>
                      <KeyRound className="w-4 h-4 mr-2" />
                      Acessar controle do imóvel
                    </Link>
                  </Button>
                )}

                {reservation.status === "pendente" && (
                  <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground text-center">
                    Sua reserva está sendo analisada. Entraremos em contato em breve.
                  </div>
                )}

                <Button variant="outline" className="w-full" asChild>
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-4 h-4 mr-2 text-green-600" />
                    Falar no WhatsApp
                  </a>
                </Button>
              </div>

              {lastUpdate && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  Atualizado pelo anfitrião às{" "}
                  {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default MinhaReserva;
