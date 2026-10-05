import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Search,
  MoreVertical,
  Mail,
  Phone,
  Calendar,
  Shield,
  UserCheck,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  KeyRound,
  MapPin,
  Hash,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'admin' | 'client';
  created_at: string;
  reservationCount: number;
}

const AdminUsuarios = () => {
  const { users, loading, refetch } = useAdminUsers();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "admin" | "client">("all");
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserDetail | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "all" || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleResetPassword = async () => {
    if (!passwordUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setResettingPassword(true);
    try {
      const response = await supabase.functions.invoke("admin-reset-password", {
        body: { user_id: passwordUser.id, new_password: newPassword },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success("Senha alterada com sucesso!");
      setShowPasswordDialog(false);
      setNewPassword("");
      setPasswordUser(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha");
    } finally {
      setResettingPassword(false);
    }
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
                <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                  Gerenciar Usuários
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {users.length} usuários cadastrados
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>

          {/* Filters */}
          <div className="bg-card rounded-2xl p-4 mb-6 shadow-soft border border-border/60">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou e-mail..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterRole === "all" ? "default" : "outline"}
                  size="sm"
                  className="rounded-full text-[11px] font-semibold uppercase tracking-wide"
                  onClick={() => setFilterRole("all")}
                >
                  Todos
                </Button>
                <Button
                  variant={filterRole === "admin" ? "default" : "outline"}
                  size="sm"
                  className="rounded-full text-[11px] font-semibold uppercase tracking-wide"
                  onClick={() => setFilterRole("admin")}
                >
                  Admins
                </Button>
                <Button
                  variant={filterRole === "client" ? "default" : "outline"}
                  size="sm"
                  className="rounded-full text-[11px] font-semibold uppercase tracking-wide"
                  onClick={() => setFilterRole("client")}
                >
                  Clientes
                </Button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && users.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Users List */}
          {!loading || users.length > 0 ? (
            <div className="bg-card rounded-2xl shadow-soft border border-border/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Usuário</th>
                      <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contato</th>
                      <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Função</th>
                      <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reservas</th>
                      <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cadastro</th>
                      <th className="text-right p-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary font-semibold">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium text-foreground">{user.name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail className="w-3.5 h-3.5" />
                              {user.email}
                            </div>
                            {user.phone && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Phone className="w-3.5 h-3.5" />
                                {user.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant={user.role === "admin" ? "default" : "secondary"} className="uppercase tracking-wider text-[10px] font-bold">
                            <Shield className="w-3 h-3 mr-1" />
                            {user.role === "admin" ? "Admin" : "Cliente"}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <span className="text-foreground">{user.reservationCount}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(user.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  Ver Detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setPasswordUser(user);
                                  setShowPasswordDialog(true);
                                  setNewPassword("");
                                }}>
                                  <KeyRound className="w-4 h-4 mr-2" />
                                  Alterar Senha
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredUsers.length === 0 && !loading && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary text-2xl font-bold">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedUser.name}</h3>
                  <Badge variant={selectedUser.role === "admin" ? "default" : "secondary"} className="mt-1">
                    <Shield className="w-3 h-3 mr-1" />
                    {selectedUser.role === "admin" ? "Administrador" : "Cliente"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p className="text-sm font-medium text-foreground">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedUser.phone || "Não informado"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Hash className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total de Reservas</p>
                    <p className="text-sm font-medium text-foreground">{selectedUser.reservationCount}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data de Cadastro</p>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(selectedUser.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">ID do Usuário</p>
                    <p className="text-xs font-mono text-muted-foreground break-all">{selectedUser.id}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setPasswordUser(selectedUser);
                    setShowPasswordDialog(true);
                    setNewPassword("");
                    setSelectedUser(null);
                  }}
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  Alterar Senha
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPasswordDialog(false);
          setPasswordUser(null);
          setNewPassword("");
        }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          {passwordUser && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Alterando senha de <span className="font-semibold text-foreground">{passwordUser.name}</span>
              </p>
              <div className="space-y-2">
                <Label>Nova Senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <Button
                className="w-full"
                disabled={resettingPassword || newPassword.length < 6}
                onClick={handleResetPassword}
              >
                {resettingPassword ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <KeyRound className="w-4 h-4 mr-2" />
                )}
                Confirmar Alteração
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminUsuarios;
