import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMyReservationIds, effectiveStatus, fetchGuestReservations, GuestReservation } from "@/lib/myReservations";
import {
  Calendar,
  MapPin,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  QrCode,
  ClipboardList,
  CreditCard,
  FileSignature,
  KeyRound,
  Nfc,
} from "lucide-react";

interface MyReservation extends GuestReservation {
  property: { title: string; neighborhood: string | null } | null;
}

const statusInfo: Record<string, { label: string; action: string; className: string; icon: typeof Clock }> = {
  pendente: { label: "Em análise", action: "Acompanhar reserva", className: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Clock },
  aguardando_pix: { label: "Aguardando Pix", action: "Pagar com Pix", className: "bg-teal-100 text-teal-800 border-teal-300", icon: QrCode },
  aguardando_pagamento: { label: "Aguardando pagamento", action: "Ver pagamento", className: "bg-teal-100 text-teal-800 border-teal-300", icon: QrCode },
  pagamento_na_entrada: { label: "Pagamento na entrada", action: "Preencher dados", className: "bg-blue-100 text-blue-800 border-blue-300", icon: ClipboardList },
  faltando_cartao: { label: "Cartão pendente", action: "Cadastrar cartão", className: "bg-purple-100 text-purple-800 border-purple-300", icon: CreditCard },
  aguardando_assinatura: { label: "Aguardando assinatura", action: "Assinar contrato", className: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: FileSignature },
  pagamento_aproximacao: { label: "Pagto na chegada", action: "Ver instruções", className: "bg-cyan-100 text-cyan-800 border-cyan-300", icon: Nfc },
  aproximacao_senha: { label: "Confirmar cartão", action: "Digitar dígitos", className: "bg-sky-100 text-sky-800 border-sky-300", icon: CreditCard },
  confirmada: { label: "Confirmada", action: "Abrir reserva", className: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle },
  cancelada: { label: "Cancelada", action: "Ver detalhes", className: "bg-red-100 text-red-800 border-red-300", icon: XCircle },
};

const formatDateBR = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");

// Shows the guest's latest reservation at the top of the site once
// a reservation exists on this device — no login required.
export function MyReservationBanner() {
  const [reservation, setReservation] = useState<MyReservation | null>(null);

  useEffect(() => {
    const ids = getMyReservationIds();
    if (ids.length === 0) return;

    let prevStatus: string | null = null;
    const load = async () => {
      const rows = await fetchGuestReservations(ids);
      const data = rows[0];
      if (data) {
        const eff = effectiveStatus(data.status, data.pix_method, data.pix_message);
        if (prevStatus && prevStatus !== eff) {
          toast.success("Sua reserva foi atualizada pelo anfitrião!");
        }
        prevStatus = eff;
        setReservation({
          ...data,
          property: data.property_title
            ? { title: data.property_title, neighborhood: data.property_neighborhood }
            : null,
        });
      }
    };

    load();

    // Poll for admin updates (guest reads go through the RPC — no
    // realtime subscription without a SELECT policy).
    const interval = setInterval(load, 6000);
    return () => clearInterval(interval);
  }, []);

  if (!reservation) return null;

  const info = statusInfo[effectiveStatus(reservation.status, reservation.pix_method, reservation.pix_message)] ?? statusInfo.pendente;
  const StatusIcon = info.icon;

  return (
    <section className="bg-secondary pt-4 pb-2">
      <div className="container mx-auto px-4">
        <Link to={`/reserva/${reservation.id}`} className="block max-w-3xl mx-auto">
          <div className="bg-card border-2 border-primary/30 rounded-2xl p-4 md:p-5 shadow-card hover:shadow-elevated transition-shadow">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                Sua reserva
              </span>
              <Badge variant="outline" className={`${info.className} whitespace-nowrap`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {info.label}
              </Badge>
            </div>

            <h2 className="font-display text-lg md:text-xl font-bold text-foreground">
              {reservation.property?.title}
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              {reservation.property?.neighborhood}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <Calendar className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              {formatDateBR(reservation.check_in)} → {formatDateBR(reservation.check_out)}
            </p>

            <div className="flex items-center gap-2 mt-4">
              <Button variant="gold" className="w-full">
                {info.action}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
