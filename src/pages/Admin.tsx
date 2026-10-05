import { Link } from "react-router-dom";
import { formatDateBR } from "@/lib/utils";

import { Layout } from "@/components/layout/Layout";
import { 
  Users, 
  CalendarCheck, 
  Building2, 
  Bell,
  DollarSign,
  UserCheck,
  Loader2,
  MessageSquare,
  CreditCard,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useAdminReservations } from "@/hooks/useAdminReservations";

const Admin = () => {
  const { stats, loading: statsLoading } = useAdminStats();
  const { reservations, loading: reservationsLoading } = useAdminReservations();

  const recentReservations = reservations.slice(0, 3);

  const statsData = [
    {
      label: "Reservas Ativas",
      value: stats.activeReservations.toString(),
      icon: CalendarCheck,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      label: "Usuários Cadastrados",
      value: stats.totalUsers.toString(),
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Imóveis Ativos",
      value: stats.activeProperties.toString(),
      icon: Building2,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      label: "Faturamento Mensal",
      value: `R$ ${stats.monthlyRevenue.toLocaleString("pt-BR")}`,
      icon: DollarSign,
      color: "text-accent",
      bgColor: "bg-amber-100",
    },
  ];

  const quickActions = [
    { to: "/admin/reservas", label: "Reservas", icon: CalendarCheck, color: "text-green-600", bgColor: "bg-green-100" },
    { to: "/admin/usuarios", label: "Usuários", icon: Users, color: "text-blue-600", bgColor: "bg-blue-100" },
    { to: "/admin/imoveis", label: "Imóveis", icon: Building2, color: "text-purple-600", bgColor: "bg-purple-100" },
    { to: "/admin/notificacoes", label: "Notificações", icon: Bell, color: "text-amber-600", bgColor: "bg-amber-100" },
    { to: "/admin/comentarios", label: "Comentários", icon: MessageSquare, color: "text-teal-600", bgColor: "bg-teal-100" },
    { to: "/admin/pagamento-entrada", label: "Pgto Entrada", icon: CreditCard, color: "text-sky-600", bgColor: "bg-sky-100" },
    { to: "/admin/alta-temporada", label: "Alta Temporada", icon: Sun, color: "text-primary", bgColor: "bg-primary/10" },
  ];


  return (
    <Layout>
      <div className="bg-secondary flex-1 py-6 md:py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <Reveal className="mb-6 md:mb-8">
            <span className="eyebrow">Admin</span>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight mt-1 mb-1.5">
              Painel Administrativo
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Visão geral do seu negócio de locação de imóveis
            </p>
          </Reveal>

          {/* Stats Grid */}
          <Reveal stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {statsData.map((stat, index) => (
              <div key={index} className="bg-card rounded-xl p-3.5 md:p-4 shadow-soft border border-border/60 hover:shadow-card transition-shadow flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl md:text-2xl font-bold tracking-tight text-foreground leading-none mb-1">
                    {statsLoading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : stat.value}
                  </h3>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{stat.label}</p>
                </div>
              </div>
            ))}
          </Reveal>

          {/* Quick Actions */}
          <Reveal className="bg-card rounded-2xl shadow-soft border border-border/60 p-4 md:p-5 mb-5">
            <h2 className="font-display text-lg font-semibold mb-3">Gestão</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {quickActions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 px-2 py-3.5 text-center transition-all hover:bg-primary/5 hover:border-primary/40 hover:shadow-soft"
                >
                  <div className={`w-9 h-9 rounded-lg ${action.bgColor} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <action.icon className={`w-[18px] h-[18px] ${action.color}`} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground group-hover:text-foreground leading-tight">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </Reveal>

          {/* Recent Reservations */}
          <Reveal className="bg-card rounded-2xl p-4 md:p-5 shadow-soft border border-border/60">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Reservas Recentes</h2>
              <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wide" asChild>
                <Link to="/admin/reservas">Ver todas</Link>
              </Button>
            </div>

            {reservationsLoading && recentReservations.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : recentReservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CalendarCheck className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma reserva encontrada.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentReservations.map((reservation) => (
                  <div
                    key={reservation.id}
                    className="flex items-center justify-between gap-3 p-3.5 bg-secondary/60 rounded-xl border border-border/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <UserCheck className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{reservation.guest_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{reservation.property_title}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium">
                        {formatDateBR(reservation.check_in)} - {formatDateBR(reservation.check_out)}
                      </p>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          reservation.status === "confirmada"
                            ? "bg-green-100 text-green-700"
                            : reservation.status === "pendente"
                            ? "bg-yellow-100 text-yellow-700"
                            : reservation.status === "aguardando_pagamento"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {reservation.status === "confirmada" ? "Confirmada" :
                         reservation.status === "pendente" ? "Pendente" :
                         reservation.status === "aguardando_pagamento" ? "Aguardando Pgto" : "Cancelada"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Reveal>
        </div>
      </div>
    </Layout>
  );
};

export default Admin;
