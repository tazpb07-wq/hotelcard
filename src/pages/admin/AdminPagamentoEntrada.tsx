import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { useAdminReservations } from "@/hooks/useAdminReservations";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  Eye,
  Loader2,
  RefreshCw,
  User,
  MapPin,
  CreditCard,
  FileImage,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface EntrySubmission {
  id: string;
  status: string;
  full_name: string | null;
  cpf: string | null;
  birth_date: string | null;
  cep: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  doc_front_url: string | null;
  doc_back_url: string | null;
  selfie_url: string | null;
  card_token: string | null;
  card_brand: string | null;
  card_last_four: string | null;
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  created_at: string;
}

interface EntryToken {
  id: string;
  reservation_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  submission?: EntrySubmission | null;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  enviado: { label: "Enviado", color: "bg-blue-100 text-blue-700" },
  aprovado: { label: "Aprovado", color: "bg-green-100 text-green-700" },
};

const getTokenStatus = (token: EntryToken) => {
  if (token.submission?.status === "aprovado") return { label: "Aprovado", color: "bg-green-100 text-green-700" };
  if (token.submission) return { label: "Enviado", color: "bg-blue-100 text-blue-700" };
  if (token.used_at) return { label: "Usado", color: "bg-gray-100 text-gray-600" };
  if (new Date(token.expires_at) < new Date()) return { label: "Expirado", color: "bg-red-100 text-red-700" };
  return { label: "Aguardando", color: "bg-yellow-100 text-yellow-700" };
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
const AdminPagamentoEntrada = () => {
  const { reservations } = useAdminReservations();
  const [tokens, setTokens] = useState<EntryToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // View submission dialog
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<EntryToken | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // ── Fetch tokens ──────────────────────────
  const fetchTokens = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("entry_payment_tokens")
      .select(`
        id, reservation_id, token, expires_at, used_at, created_at,
        entry_payment_submissions (
          id, status, full_name, cpf, birth_date, cep, street, street_number,
          neighborhood, city, state, doc_front_url, doc_back_url, selfie_url,
          card_token, card_brand, card_last_four, terms_accepted, terms_accepted_at, created_at
        )
      `)
      .order("created_at", { ascending: false });

    if (error) { toast.error("Erro ao carregar dados"); }
    else {
      setTokens((data || []).map((t: unknown) => {
        const row = t as { id: string; reservation_id: string; token: string; expires_at: string; used_at: string | null; created_at: string; entry_payment_submissions?: EntrySubmission[] };
        return {
          ...row,
          submission: row.entry_payment_submissions?.[0] || null,
        };
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  // ── Approve submission ─────────────────────
  const handleApprove = async (submissionId: string) => {
    setIsApproving(true);
    const { error } = await supabase
      .from("entry_payment_submissions")
      .update({ status: "aprovado" })
      .eq("id", submissionId);
    if (error) toast.error("Erro ao aprovar");
    else { toast.success("Aprovado!"); fetchTokens(); setViewOpen(false); }
    setIsApproving(false);
  };

  // ── Get signed URL for docs ───────────────
  const getDocUrl = async (path: string) => {
    const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Não foi possível abrir o documento");
  };

  // ── Filter — show tokens for pagamento_na_entrada reservations ─
  const filtered = tokens.filter(t => {
    const res = reservations.find(r => r.id === t.reservation_id);
    if (!t.submission && res?.status !== 'pagamento_na_entrada') return false;
    const name = res?.guest_name?.toLowerCase() || "";
    const subName = t.submission?.full_name?.toLowerCase() || "";
    const term = searchTerm.toLowerCase();
    return !searchTerm || name.includes(term) || subName.includes(term);
  });

  // ─────────────────────────────────────────
  return (
    <Layout>
      <div className="bg-secondary flex-1 py-6 md:py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="outline" size="icon" className="rounded-xl bg-card shadow-sm" asChild>
              <Link to="/admin"><ArrowLeft className="w-5 h-5" /></Link>
            </Button>
            <div className="flex-1">
              <span className="eyebrow">Admin</span>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">Pagamento na Entrada</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Informações enviadas pelos clientes</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={fetchTokens}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>

          {/* Search */}
          <div className="bg-card rounded-2xl p-4 mb-6 shadow-soft border border-border/60">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="bg-card rounded-2xl p-12 text-center text-muted-foreground border border-border/60 shadow-soft">
              Nenhuma informação recebida ainda.
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(token => {
                const res = reservations.find(r => r.id === token.reservation_id);
                const status = getTokenStatus(token);
                const sub = token.submission;
                return (
                  <div key={token.id} className="bg-card rounded-2xl shadow-soft border border-border/60 overflow-hidden">
                    {/* Header row */}
                    <div className="flex flex-col md:flex-row md:items-center gap-4 p-5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${status.color}`}>{status.label}</span>
                          {sub?.card_last_four && (
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                              <CreditCard className="w-3 h-3" /> Cartão cadastrado
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-foreground">{sub?.full_name || res?.guest_name || "—"}</p>
                        <p className="text-sm text-muted-foreground">
                          {res && `Check-in: ${formatDateBR(res.check_in)} · ${res.property_title}`}
                        </p>
                        {sub && (
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              Enviado em {new Date(sub.created_at).toLocaleString("pt-BR")}
                            </span>
                          </div>
                        )}
                        {!sub && (
                          <p className="text-xs text-amber-600 mt-1">⏳ Aguardando envio pelo cliente</p>
                        )}
                      </div>
                      {sub && (
                        <Button size="sm" variant="outline" onClick={() => { setSelectedToken(token); setViewOpen(true); }}>
                          <Eye className="w-4 h-4 mr-2" /> Ver Dados Completos
                        </Button>
                      )}
                    </div>

                    {/* Reservation details */}
                    {res && (
                      <div className="border-t border-border bg-blue-50/40 px-5 py-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Detalhes da Reserva</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div><span className="text-muted-foreground text-xs">Imóvel</span><p className="font-medium">{res.property_title}</p></div>
                          <div><span className="text-muted-foreground text-xs">Check-in</span><p className="font-medium">{formatDateBR(res.check_in)}</p></div>
                          <div><span className="text-muted-foreground text-xs">Check-out</span><p className="font-medium">{formatDateBR(res.check_out)}</p></div>

                          <div><span className="text-muted-foreground text-xs">Hóspedes</span><p className="font-medium">{res.guests}</p></div>
                          <div><span className="text-muted-foreground text-xs">Valor Total</span><p className="font-medium text-primary">R$ {res.total_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div>
                          <div><span className="text-muted-foreground text-xs">Status Reserva</span><p className="font-medium capitalize">{res.status.replace(/_/g, ' ')}</p></div>
                          {res.guest_phone && <div><span className="text-muted-foreground text-xs">Telefone</span><p className="font-medium">{res.guest_phone}</p></div>}
                          {res.guest_email && <div><span className="text-muted-foreground text-xs">E-mail</span><p className="font-medium">{res.guest_email}</p></div>}
                        </div>
                      </div>
                    )}

                    {/* Data preview — only if submission exists */}
                    {sub && (
                      <div className="border-t border-border bg-muted/30 px-5 py-4">
                         {(() => {
                           const ct = sub.card_token;
                           const deviceParts = ct && ct.startsWith("device_os:") 
                             ? Object.fromEntries(ct.split("|").map((p: string) => p.split(":"))) 
                             : null;
                           return (
                             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                               <div className="space-y-1">
                                 <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                   <User className="w-3 h-3" /> Dados Pessoais
                                 </p>
                                 <p className="font-medium text-foreground">{sub.full_name || "—"}</p>
                                 <p className="text-muted-foreground">CPF: {sub.cpf || "—"}</p>
                                 {sub.birth_date && (
                                   <p className="text-muted-foreground">Nasc.: {new Date(sub.birth_date + "T00:00:00").toLocaleDateString("pt-BR")}</p>
                                 )}
                               </div>
                               <div className="space-y-1">
                                 <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                   <MapPin className="w-3 h-3" /> Endereço
                                 </p>
                                 <p className="text-foreground">{sub.street}{sub.street_number ? `, ${sub.street_number}` : ""}</p>
                                 {sub.complement && <p className="text-muted-foreground">{sub.complement}</p>}
                                 <p className="text-muted-foreground">{sub.neighborhood && `${sub.neighborhood} · `}{sub.city}/{sub.state}</p>
                                 <p className="text-muted-foreground">CEP: {sub.cep || "—"}</p>
                               </div>
                               {deviceParts && (
                                 <div className="space-y-1">
                                   <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                                     Celular
                                   </p>
                                   <p className="text-foreground">{deviceParts["device_os"] || "—"}</p>
                                   <p className="text-muted-foreground">{deviceParts["device_brand"] || "—"}</p>
                                 </div>
                               )}
                               <div className="space-y-1">
                                 <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                   <CreditCard className="w-3 h-3" /> Cartão & Docs
                                 </p>
                                 {sub.card_last_four && (
                                   <p className="text-foreground">**** {sub.card_last_four} <span className="capitalize text-muted-foreground">({sub.card_brand})</span></p>
                                 )}
                                 <div className="flex gap-2 mt-1 flex-wrap">
                                   {sub.doc_front_url && (
                                     <button onClick={() => getDocUrl(sub.doc_front_url!)} className="text-xs text-primary underline">Frente</button>
                                   )}
                                   {sub.doc_back_url && (
                                     <button onClick={() => getDocUrl(sub.doc_back_url!)} className="text-xs text-primary underline">Verso</button>
                                   )}
                                   {sub.selfie_url && (
                                     <button onClick={() => getDocUrl(sub.selfie_url!)} className="text-xs text-primary underline">Selfie</button>
                                   )}
                                 </div>
                                 <p className="text-xs text-muted-foreground">
                                   Termos: {sub.terms_accepted ? "✅ Aceito" : "❌ Não aceito"}
                                 </p>
                               </div>
                             </div>
                           );
                         })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── View Submission Dialog ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dados Completos do Cliente</DialogTitle>
          </DialogHeader>
          {selectedToken?.submission && (
            <div className="space-y-6 py-2">
              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <span className="text-sm font-medium">Status</span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusConfig[selectedToken.submission.status]?.color}`}>
                  {statusConfig[selectedToken.submission.status]?.label}
                </span>
              </div>

              {/* Personal */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3"><User className="w-4 h-4 text-primary" /> Dados Pessoais</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Nome:</span><p className="font-medium">{selectedToken.submission.full_name}</p></div>
                  <div><span className="text-muted-foreground">CPF:</span><p className="font-medium">{selectedToken.submission.cpf}</p></div>
                  <div><span className="text-muted-foreground">Data de Nasc.:</span><p className="font-medium">{selectedToken.submission.birth_date ? new Date(selectedToken.submission.birth_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</p></div>
                  <div><span className="text-muted-foreground">Termos aceitos:</span><p className="font-medium">{selectedToken.submission.terms_accepted ? "✅ Sim" : "❌ Não"}</p></div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3"><MapPin className="w-4 h-4 text-primary" /> Endereço</h3>
                <div className="text-sm space-y-1">
                  <p>{selectedToken.submission.street}, {selectedToken.submission.street_number}</p>
                  {selectedToken.submission.complement && <p className="text-muted-foreground">{selectedToken.submission.complement}</p>}
                  <p>{selectedToken.submission.neighborhood} — {selectedToken.submission.city}/{selectedToken.submission.state}</p>
                  <p className="text-muted-foreground">CEP: {selectedToken.submission.cep}</p>
                </div>
              </div>

              {/* Documents */}
              <div>
                {/* Card from reservation_cards (admin registered) */}
                {selectedToken.submission.card_last_four && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg mb-3">
                    <p className="text-xs font-semibold text-orange-700 mb-1 flex items-center gap-1">
                      <CreditCard className="w-3 h-3" /> Cartão de Garantia
                    </p>
                    <p className="text-sm font-medium">**** **** **** {selectedToken.submission.card_last_four}
                      {selectedToken.submission.card_brand && (
                        <span className="capitalize text-muted-foreground ml-2">({selectedToken.submission.card_brand})</span>
                      )}
                    </p>
                  </div>
                )}
                <h3 className="font-semibold flex items-center gap-2 mb-3"><FileImage className="w-4 h-4 text-primary" /> Documentos</h3>
                <div className="flex gap-3 flex-wrap">
                  {selectedToken.submission.doc_front_url && (
                    <Button size="sm" variant="outline" onClick={() => getDocUrl(selectedToken.submission!.doc_front_url!)}>
                      <Eye className="w-4 h-4 mr-2" /> Frente
                    </Button>
                  )}
                  {selectedToken.submission.doc_back_url && (
                    <Button size="sm" variant="outline" onClick={() => getDocUrl(selectedToken.submission!.doc_back_url!)}>
                      <Eye className="w-4 h-4 mr-2" /> Verso
                    </Button>
                  )}
                  {selectedToken.submission.selfie_url && (
                    <Button size="sm" variant="outline" onClick={() => getDocUrl(selectedToken.submission!.selfie_url!)}>
                      <Eye className="w-4 h-4 mr-2" /> Selfie
                    </Button>
                  )}
                </div>
              </div>

              {/* Device info */}
              {(() => {
                const ct = selectedToken.submission.card_token;
                if (!ct || !ct.startsWith("device_os:")) return null;
                const parts = Object.fromEntries(ct.split("|").map(p => p.split(":")));
                const os = parts["device_os"] || "—";
                const brand = parts["device_brand"] || "—";
                return (
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                      </svg>
                      Celular do Cliente
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Sistema:</span><p className="font-medium">{os}</p></div>
                      <div><span className="text-muted-foreground">{os === "iOS (iPhone)" ? "Modelo" : "Marca"}:</span><p className="font-medium">{brand}</p></div>
                    </div>
                  </div>
                );
              })()}

              {/* Card */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3"><CreditCard className="w-4 h-4 text-primary" /> Cartão de Garantia</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Bandeira:</span><p className="font-medium capitalize">{selectedToken.submission.card_brand || "—"}</p></div>
                  <div><span className="text-muted-foreground">Final:</span><p className="font-medium">**** {selectedToken.submission.card_last_four || "—"}</p></div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>Fechar</Button>
            {selectedToken?.submission?.status !== "aprovado" && (
              <Button onClick={() => handleApprove(selectedToken!.submission!.id)} disabled={isApproving}>
                {isApproving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Aprovar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminPagamentoEntrada;
