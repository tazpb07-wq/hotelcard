import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Bell,
  CalendarCheck,
  UserPlus,
  CreditCard,
  MessageSquare,
  Check,
  Trash2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: "reservation" | "user" | "payment" | "message";
  title: string;
  description: string;
  time: string;
  read: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "reservation",
    title: "Nova reserva recebida",
    description: "Maria Silva solicitou reserva para Flat Aconchego (02/02 - 05/02)",
    time: "Há 2 horas",
    read: false,
  },
  {
    id: "2",
    type: "user",
    title: "Novo usuário cadastrado",
    description: "Pedro Lima criou uma conta no sistema",
    time: "Há 5 horas",
    read: false,
  },
  {
    id: "3",
    type: "reservation",
    title: "Reserva confirmada",
    description: "João Santos confirmou reserva para Apartamento Vista Mar",
    time: "Há 1 dia",
    read: true,
  },
  {
    id: "4",
    type: "message",
    title: "Nova mensagem de contato",
    description: "Carolina Mendes enviou uma mensagem pelo formulário de contato",
    time: "Há 1 dia",
    read: true,
  },
  {
    id: "5",
    type: "reservation",
    title: "Check-out realizado",
    description: "Ana Costa finalizou sua estadia na Cobertura Luxo",
    time: "Há 2 dias",
    read: true,
  },
  {
    id: "6",
    type: "payment",
    title: "Pagamento recebido",
    description: "Pagamento de R$ 1.750 recebido referente à reserva RES002",
    time: "Há 3 dias",
    read: true,
  },
];

const AdminNotificacoes = () => {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("Todas as notificações foram marcadas como lidas");
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notificação removida");
  };

  const clearAll = () => {
    setNotifications([]);
    toast.success("Todas as notificações foram removidas");
  };

  const getIcon = (type: Notification["type"]) => {
    const icons = {
      reservation: CalendarCheck,
      user: UserPlus,
      payment: CreditCard,
      message: MessageSquare,
    };
    const Icon = icons[type];
    return <Icon className="w-5 h-5" />;
  };

  const getIconColor = (type: Notification["type"]) => {
    const colors = {
      reservation: "bg-blue-100 text-blue-600",
      user: "bg-green-100 text-green-600",
      payment: "bg-amber-100 text-amber-600",
      message: "bg-purple-100 text-purple-600",
    };
    return colors[type];
  };

  return (
    <Layout>
      <div className="bg-secondary flex-1 py-6 md:py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="rounded-xl bg-card shadow-sm" asChild>
                <Link to="/admin">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
              <div>
                <span className="eyebrow">Admin</span>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                    Notificações
                  </h1>
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="uppercase tracking-wider text-[10px] font-bold">{unreadCount} novas</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Acompanhe todas as atividades do sistema
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
                <Check className="w-4 h-4 mr-2" />
                Marcar todas como lidas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                disabled={notifications.length === 0}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar tudo
              </Button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="space-y-4">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-card rounded-2xl p-5 shadow-soft border border-border/60 transition-all ${
                    !notification.read ? "border-l-4 border-primary" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${getIconColor(
                        notification.type
                      )}`}
                    >
                      {getIcon(notification.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3
                            className={`font-semibold ${
                              !notification.read ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {notification.title}
                          </h3>
                          <p className="text-muted-foreground text-sm mt-1">
                            {notification.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {notification.time}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-card rounded-2xl p-12 text-center border border-border/60 shadow-soft">
                <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">Nenhuma notificação</h3>
                <p className="text-muted-foreground">
                  Você verá aqui todas as atividades do sistema
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminNotificacoes;
