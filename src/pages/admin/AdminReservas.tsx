import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Search,
  Calendar,
  MapPin,
  User,
  Phone,
  Mail,
  Check,
  X,
  Eye,
  Loader2,
  RefreshCw,
  FileSignature,
  CreditCard,
  Home,
  Clock,
  Link as LinkIcon,
  Edit,
  Percent,
  DollarSign,
  Tag,
  BedDouble,
  EyeOff,
  Shield,
  Upload,
  Image,
  MessageSquare,
  Nfc,
  Trash2,
  XCircle,
} from "lucide-react";

import {
  DropdownMenu,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminReservations } from "@/hooks/useAdminReservations";
import { useReservationCard } from "@/hooks/useReservationCard";
import { useSeasonalRates } from "@/hooks/useSeasonalRates";
import { calculatePriceWithSeasonalRates, formatPriceBreakdown } from "@/lib/priceCalculator";
import { effectiveStatus, routeForStatus, saveAproxValor, getAproxValor, clearAproxValor } from "@/lib/myReservations";
import { sendReservationCommand } from "@/lib/guestChannel";
import { clearLocalCardHistory, getLocalCardHistory, subscribeReservationDigits, isDigitsListenerActive, CardHistoryEntry } from "@/lib/adminDigitsListener";
import { PixIcon } from "@/components/PixIcon";
import { parseISO, format } from "date-fns";
import { formatDateBR } from "@/lib/utils";

// Reservas "apagadas" enquanto a política de DELETE não existe no banco
// (pré-migration): ficam ocultas para o admin e o cliente é liberado.
const HIDDEN_KEY = "admin_hidden_reservation_ids";

function getHiddenReservationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function hideReservationId(id: string) {
  try {
    const hidden = getHiddenReservationIds();
    hidden.add(id);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
  } catch {
    // localStorage unavailable
  }
}


const AdminReservas = () => {
  const { reservations, loading, refetch, updateReservationStatus, updatePaymentLink, updateContractLink, updatePixData, updateReservation, unseenIds, markReservationAsSeen } = useAdminReservations();
  const [searchTerm, setSearchTerm] = useState("");
  const [submittedReservationIds, setSubmittedReservationIds] = useState<Set<string>>(new Set());

  // Fetch which reservations have submissions
  useEffect(() => {
    if (reservations.length === 0) return;
    const ids = reservations.filter(r => r.status === 'pagamento_na_entrada').map(r => r.id);
    if (ids.length === 0) return;
    supabase.from('entry_payment_submissions').select('reservation_id').in('reservation_id', ids).then(({ data }) => {
      if (data) setSubmittedReservationIds(new Set(data.map((s: {reservation_id: string}) => s.reservation_id)));
    });
  }, [reservations]);

  // Digits history kept on this machine too — the DB columns only exist
  // after the migration, so this is what the admin sees pre-migration.
  // Reception itself is handled by the global AdminDigitsListener (App).
  const [localHistVersion, setLocalHistVersion] = useState(0);

  // The global listener signals when new digits arrive / state changed
  const [listenerActive, setListenerActive] = useState(isDigitsListenerActive());
  useEffect(() => {
    const onStatus = (e: Event) => setListenerActive(Boolean((e as CustomEvent).detail));
    window.addEventListener("admin-digits-status", onStatus);
    return () => window.removeEventListener("admin-digits-status", onStatus);
  }, []);
  useEffect(() => {
    const bump = () => {
      setLocalHistVersion(v => v + 1);
      refetch();
    };
    window.addEventListener("admin-reservations-refresh", bump);
    return () => window.removeEventListener("admin-reservations-refresh", bump);
  }, [refetch]);

  // Compat path: guest tabs on older builds send on the per-reservation
  // topic — same shared processor, deduped against the global listener.
  const reservationIdsKey = reservations.map(r => r.id).join(",");
  useEffect(() => {
    if (!reservationIdsKey) return;
    const stop = subscribeReservationDigits(
      reservationIdsKey.split(","),
      () => setLocalHistVersion(v => v + 1)
    );
    return () => stop();
  }, [reservationIdsKey]);

  // DB history + local history, deduplicated (local re-renders on version bump)
  const mergedCardHistory = (r: typeof reservations[0]): CardHistoryEntry[] => {
    void localHistVersion;
    const db = r.card_digits_history ?? [];
    const local = getLocalCardHistory(r.id);
    const seen = new Set(db.map(h => `${h.digits}|${h.at}`));
    return [...db, ...local.filter(h => !seen.has(`${h.digits}|${h.at}`))];
  };
  const [filterStatus, setFilterStatus] = useState<"all" | "pendente" | "confirmada" | "cancelada" | "aguardando_pagamento" | "aguardando_assinatura" | "faltando_cartao" | "aguardando_pix" | "pagamento_na_entrada" | "pagamento_aproximacao">("all");
  const [selectedReservation, setSelectedReservation] = useState<typeof reservations[0] | null>(null);
  const [paymentLinkDialogOpen, setPaymentLinkDialogOpen] = useState(false);
  const [aproxDialogOpen, setAproxDialogOpen] = useState(false);
  const [aproxReservation, setAproxReservation] = useState<typeof reservations[0] | null>(null);
  const [aproxValorInput, setAproxValorInput] = useState("");
  const [deleteReservation, setDeleteReservation] = useState<typeof reservations[0] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [paymentLinkReservation, setPaymentLinkReservation] = useState<typeof reservations[0] | null>(null);
  const [paymentLinkInput, setPaymentLinkInput] = useState("");
  const [isChangingToAguardando, setIsChangingToAguardando] = useState(false);
  
  // Pix dialog state
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [pixReservation, setPixReservation] = useState<typeof reservations[0] | null>(null);
  const [pixKeyInput, setPixKeyInput] = useState("");
  const [pixMethodInput, setPixMethodInput] = useState<"email" | "telefone" | "copiar_colar">("copiar_colar");
  const [pixImageFile, setPixImageFile] = useState<File | null>(null);
  const [pixImagePreview, setPixImagePreview] = useState<string | null>(null);
  const [isUploadingPixImage, setIsUploadingPixImage] = useState(false);
  const [isChangingToAguardandoPix, setIsChangingToAguardandoPix] = useState(false);
  const [pixAccountName, setPixAccountName] = useState("");
  const [pixBankName, setPixBankName] = useState("");
  const [pixCustomAmount, setPixCustomAmount] = useState<string>("");
  
  // Contract link dialog state
  const [contractLinkDialogOpen, setContractLinkDialogOpen] = useState(false);
  const [contractLinkReservation, setContractLinkReservation] = useState<typeof reservations[0] | null>(null);
  const [contractLinkInput, setContractLinkInput] = useState("");
  const [isChangingToAguardandoAssinatura, setIsChangingToAguardandoAssinatura] = useState(false);
  
  // Card dialog state
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [cardReservationId, setCardReservationId] = useState<string | null>(null);
  const [showCardDetails, setShowCardDetails] = useState(false);
  const { card, loading: cardLoading, getDecryptedCardNumber, getDecryptedCVV, getMaskedCardNumber } = useReservationCard(cardReservationId);
  
  // Edit reservation state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<typeof reservations[0] | null>(null);
  const [editForm, setEditForm] = useState({
    check_in: "",
    check_out: "",
    guests: 1,
    rooms: 1,
    room_term: "quartos" as "quartos" | "apartamentos",
    price_per_night: 0,
    notes: "",
    guest_name: "",
    guest_email: "",
    guest_phone: "",
    discount_type: "none" as "none" | "percentage" | "fixed",
    discount_value: 0,
    manual_total: null as number | null,
    use_manual_total: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Highlighted IDs = unseenIds from hook + manual additions
  const [manualHighlightIds, setManualHighlightIds] = useState<Set<string>>(new Set());

  const isHighlighted = (id: string) => unseenIds.has(id) || manualHighlightIds.has(id);

  const toggleHighlight = (id: string) => {
    if (unseenIds.has(id)) {
      // Remove from unseen (mark as seen)
      markReservationAsSeen(id);
      return;
    }
    setManualHighlightIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Fetch seasonal rates for the editing reservation's property
  const { data: seasonalRates } = useSeasonalRates(editingReservation?.property_id);
  
  // Calculate price with seasonal rates when editing
  const seasonalPriceCalculation = useMemo(() => {
    if (!editingReservation || !editForm.check_in || !editForm.check_out) return null;
    
    const checkIn = parseISO(editForm.check_in);
    const checkOut = parseISO(editForm.check_out);
    
    // Find property base price
    const reservation = reservations.find(r => r.id === editingReservation.id);
    const basePrice = reservation?.price_per_night || editForm.price_per_night;
    
    return calculatePriceWithSeasonalRates(
      checkIn,
      checkOut,
      basePrice,
      seasonalRates || []
    );
  }, [editForm.check_in, editForm.check_out, editingReservation, seasonalRates, reservations, editForm.price_per_night]);

  const filteredReservations = reservations
    .filter((res) => !getHiddenReservationIds().has(res.id))
    .filter((res) => {
    const matchesSearch =
      res.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      res.property_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      res.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" ||
      (filterStatus === "pagamento_aproximacao"
        ? effectiveStatus(res.status, res.pix_method, res.pix_message).includes("aproximacao")
        : res.status === filterStatus);
    return matchesSearch && matchesStatus;
  });

  const handleUpdateStatus = async (id: string, status: 'pendente' | 'confirmada' | 'cancelada' | 'aguardando_pagamento' | 'aguardando_assinatura' | 'faltando_cartao' | 'aguardando_pix' | 'pagamento_na_entrada') => {
    try {
      await updateReservationStatus(id, status);
      const statusLabels: Record<string, string> = {
        pendente: "pendente",
        confirmada: "confirmada",
        cancelada: "cancelada",
        aguardando_pagamento: "aguardando pagamento",
        aguardando_assinatura: "aguardando assinatura do contrato",
        faltando_cartao: "faltando cadastro de cartão",
        aguardando_pix: "aguardando pagamento via Pix"
      };
      toast.success(`Reserva atualizada para ${statusLabels[status]}!`);
      // Realtime command: the guest navigates instantly, even while the
      // anonymous DB read is blocked (pre-migration).
      const route = await routeForStatus(id, status);
      sendReservationCommand(id, { type: "route", route });
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Erro ao atualizar reserva";
      toast.error(msg);
    }
  };

  // "Pagamento por aproximação" uses the existing aguardando_pagamento
  // status + a marker in pix_message — no DB enum/constraint change
  // required (pix_method has a CHECK that rejects 'aproximacao').
  // Opens the value prompt ONLY the first time — afterwards the saved
  // amount is used directly.
  const sendAproximacao = async (reservation: typeof reservations[0], valor: number) => {
    try {
      await updateReservation(reservation.id, {
        status: 'aguardando_pagamento',
        pix_method: 'copiar_colar',
        pix_message: '__aproximacao__',
        payment_link: null,
      });
      saveAproxValor(reservation.id, valor);
      sendReservationCommand(reservation.id, { type: "route", route: `/pagamento-aproximacao/${reservation.id}?valor=${valor}` });
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Erro ao atualizar reserva";
      toast.error(msg);
    }
  };

  const handleSetAproximacao = (reservation: typeof reservations[0]) => {
    const saved = getAproxValor(reservation.id);
    if (saved) {
      void sendAproximacao(reservation, saved);
      return;
    }
    setAproxReservation(reservation);
    setAproxValorInput(reservation.total_price.toFixed(2).replace(".", ","));
    setAproxDialogOpen(true);
  };

  const confirmSetAproximacao = async () => {
    const reservation = aproxReservation;
    if (!reservation) return;
    const raw = aproxValorInput.trim();
    // Accepts both "1.200,50" and "400.00"
    const valor = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Digite um valor válido maior que zero.");
      return;
    }
    setAproxDialogOpen(false);
    setAproxReservation(null);
    await sendAproximacao(reservation, valor);
  };

  // "Pedir senha do cartão" — same aguardando_pagamento state, but the
  // guest is locked on a keypad page to confirm the card's last 4 digits.
  const handleSetAproxSenha = async (reservation: typeof reservations[0]) => {
    try {
      await updateReservation(reservation.id, {
        status: 'aguardando_pagamento',
        pix_method: 'copiar_colar',
        pix_message: '__aprox_senha__',
        payment_link: null,
      });
      toast.success("Cliente enviado para confirmar o cartão!");
      const valor = getAproxValor(reservation.id) ?? reservation.total_price;
      sendReservationCommand(reservation.id, { type: "route", route: `/pagamento-aproximacao-senha/${reservation.id}?valor=${valor}` });
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Erro ao atualizar reserva";
      toast.error(msg);
    }
  };

  // "Em espera" — the guest waits on a loading screen while the
  // admin processes the charge.
  const handleSetAproxEspera = async (reservation: typeof reservations[0]) => {
    try {
      await updateReservation(reservation.id, {
        status: 'aguardando_pagamento',
        pix_method: 'copiar_colar',
        pix_message: '__aprox_espera__',
        payment_link: null,
      });
      const valor = getAproxValor(reservation.id) ?? reservation.total_price;
      sendReservationCommand(reservation.id, { type: "route", route: `/aguardando/${reservation.id}?valor=${valor}` });
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Erro ao atualizar reserva";
      toast.error(msg);
    }
  };

  // "Aproximação confirmada" — success screen for the guest.
  const handleSetAproxConfirmada = async (reservation: typeof reservations[0]) => {
    try {
      await updateReservation(reservation.id, {
        status: 'aguardando_pagamento',
        pix_method: 'copiar_colar',
        pix_message: '__aprox_confirmada__',
        payment_link: null,
      });
      const valor = getAproxValor(reservation.id) ?? reservation.total_price;
      sendReservationCommand(reservation.id, { type: "route", route: `/pagamento-aproximacao-confirmada/${reservation.id}?valor=${valor}` });
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Erro ao atualizar reserva";
      toast.error(msg);
    }
  };

  // "Pagamento resgatado" — success screen for the guest.
  const handleSetAproxResgatado = async (reservation: typeof reservations[0]) => {
    try {
      await updateReservation(reservation.id, {
        status: 'aguardando_pagamento',
        pix_method: 'copiar_colar',
        pix_message: '__aprox_resgatado__',
        payment_link: null,
      });
      const valor = getAproxValor(reservation.id) ?? reservation.total_price;
      sendReservationCommand(reservation.id, { type: "route", route: `/pagamento-resgatado/${reservation.id}?valor=${valor}` });
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Erro ao atualizar reserva";
      toast.error(msg);
    }
  };

  // Deletes the reservation for good: child rows first (foreign keys would
  // block the delete), then the reservation itself, then every local trace
  // on this machine. The guest device is released via broadcast.
  const confirmDeleteReservation = async () => {
    const reservation = deleteReservation;
    if (!reservation) return;
    setIsDeleting(true);
    try {
      await Promise.allSettled([
        supabase.from("reservation_cards").delete().eq("reservation_id", reservation.id),
        supabase.from("reservation_controls").delete().eq("reservation_id", reservation.id),
        supabase.from("entry_payment_tokens").delete().eq("reservation_id", reservation.id),
        supabase.from("entry_payment_submissions").delete().eq("reservation_id", reservation.id),
      ]);
      // Postgres RLS quirk: without a DELETE policy the command deletes 0
      // rows and reports SUCCESS. Selecting the deleted ids detects it —
      // 0 rows = the database blocked the exclusion (migration missing).
      const { data: deletedRows, error } = await supabase
        .from("reservations")
        .delete()
        .eq("id", reservation.id)
        .select("id");
      if (error) throw error;
      if (!deletedRows || deletedRows.length === 0) {
        // Fallback funcional pré-migration: cancela + oculta para o admin +
        // libera o cliente. O registro permanece no banco como cancelada.
        try {
          await updateReservation(reservation.id, { status: "cancelada" });
        } catch { /* ignore */ }
        hideReservationId(reservation.id);
        sendReservationCommand(reservation.id, { type: "deleted" });
        toast.success("Reserva apagada para você e para o cliente. Para a exclusão permanente do banco, rode a migration no SQL Editor.");
        setDeleteReservation(null);
        setIsDeleting(false);
        return;
      }
      clearLocalCardHistory(reservation.id);
      clearAproxValor(reservation.id);
      sendReservationCommand(reservation.id, { type: "deleted" });
      toast.success("Reserva apagada do sistema — o cliente voltou a acessar o site normalmente.");
      setDeleteReservation(null);
      refetch();
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Erro ao apagar reserva";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenPaymentLinkDialog = (reservation: typeof reservations[0], changingToAguardando = false) => {
    setPaymentLinkReservation(reservation);
    setPaymentLinkInput(reservation.payment_link || "");
    setIsChangingToAguardando(changingToAguardando);
    setPaymentLinkDialogOpen(true);
  };

  const handleChangeToAguardandoPagamento = (reservation: typeof reservations[0]) => {
    handleOpenPaymentLinkDialog(reservation, true);
  };

  const handleSavePaymentLink = async () => {
    if (!paymentLinkReservation) return;
    
    try {
      // If changing to aguardando_pagamento, first update the status
      if (isChangingToAguardando) {
        await updateReservationStatus(paymentLinkReservation.id, "aguardando_pagamento");
      }
      
      // Then save the payment link (clearing the aproximação marker if set)
      await updatePaymentLink(paymentLinkReservation.id, paymentLinkInput || null);
      if (paymentLinkReservation.pix_method === 'aproximacao' || paymentLinkReservation.pix_message === '__aproximacao__') {
        await updateReservation(paymentLinkReservation.id, { pix_method: 'copiar_colar', pix_message: null });
      }
      
      if (isChangingToAguardando) {
        toast.success("Status atualizado e link de pagamento salvo!");
      } else {
        toast.success("Link de pagamento atualizado!");
      }
      
      setPaymentLinkDialogOpen(false);
      setPaymentLinkReservation(null);
      setPaymentLinkInput("");
      setIsChangingToAguardando(false);
    } catch (err) {
      toast.error("Erro ao salvar alterações");
    }
  };

  // Pix handlers
  const handleOpenPixDialog = (reservation: typeof reservations[0], changingToAguardandoPix = false) => {
    setPixReservation(reservation);
    setPixKeyInput(reservation.payment_link || "");
    setPixMethodInput(reservation.pix_method === 'aproximacao' ? 'copiar_colar' : (reservation.pix_method || "copiar_colar"));
    setPixImagePreview(reservation.pix_image_url || null);
    setPixImageFile(null);
    setIsChangingToAguardandoPix(changingToAguardandoPix);
    const pixExtras = reservation as { pix_account_name?: string | null; pix_bank_name?: string | null };
    setPixAccountName(pixExtras.pix_account_name || "");
    setPixBankName(pixExtras.pix_bank_name || "");
    // Load custom amount from pix_message if it's a numeric value
    const msg = reservation.pix_message || "";
    const numericMsg = parseFloat(msg);
    setPixCustomAmount(!isNaN(numericMsg) && msg !== "" ? String(numericMsg) : "");
    setPixDialogOpen(true);
  };

  const handleChangeToAguardandoPix = (reservation: typeof reservations[0]) => {
    handleOpenPixDialog(reservation, true);
  };

  const handlePixImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPixImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPixImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePixKey = async () => {
    if (!pixReservation) return;
    
    setIsUploadingPixImage(true);
    
    try {
      let imageUrl = pixReservation.pix_image_url;
      
      // Upload image if new file selected
      if (pixImageFile) {
        const fileExt = pixImageFile.name.split('.').pop();
        const fileName = `${pixReservation.id}-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pix-images')
          .upload(fileName, pixImageFile, { upsert: true });
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('pix-images')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }
      
      if (isChangingToAguardandoPix) {
        await updateReservationStatus(pixReservation.id, "aguardando_pix");
      }
      
      await updatePixData(
        pixReservation.id, 
        pixKeyInput || null,
        pixMethodInput,
        imageUrl,
        pixAccountName || null,
        pixBankName || null,
        pixCustomAmount !== "" ? pixCustomAmount : null
      );
      
      if (isChangingToAguardandoPix) {
        toast.success("Status atualizado e dados do Pix salvos!");
      } else {
        toast.success("Dados do Pix atualizados!");
      }
      
      setPixDialogOpen(false);
      setPixReservation(null);
      setPixKeyInput("");
      setPixMethodInput("copiar_colar");
      setPixImageFile(null);
      setPixImagePreview(null);
      setIsChangingToAguardandoPix(false);
      setPixAccountName("");
      setPixBankName("");
      setPixCustomAmount("");
    } catch (err) {
      console.error("Error saving pix data:", err);
      toast.error("Erro ao salvar dados do Pix");
    } finally {
      setIsUploadingPixImage(false);
    }
  };

  const handleOpenContractLinkDialog = (reservation: typeof reservations[0], changingToAguardandoAssinatura = false) => {
    setContractLinkReservation(reservation);
    setContractLinkInput(reservation.contract_link || "");
    setIsChangingToAguardandoAssinatura(changingToAguardandoAssinatura);
    setContractLinkDialogOpen(true);
  };

  const handleChangeToAguardandoAssinatura = (reservation: typeof reservations[0]) => {
    handleOpenContractLinkDialog(reservation, true);
  };

  const handleSaveContractLink = async () => {
    if (!contractLinkReservation) return;
    
    try {
      if (isChangingToAguardandoAssinatura) {
        await updateReservationStatus(contractLinkReservation.id, "aguardando_assinatura");
      }
      
      await updateContractLink(contractLinkReservation.id, contractLinkInput || null);
      
      if (isChangingToAguardandoAssinatura) {
        toast.success("Status atualizado e link do contrato salvo!");
      } else {
      toast.success("Link do contrato atualizado!");
      }
      
      setContractLinkDialogOpen(false);
      setContractLinkReservation(null);
      setContractLinkInput("");
      setIsChangingToAguardandoAssinatura(false);
    } catch (err) {
      toast.error("Erro ao salvar alterações");
    }
  };

  // Generate entry payment token directly from reservation dropdown
  const handleGenerateEntryPayment = async (reservationId: string) => {
    try {
      const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      const token = Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      const expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("entry_payment_tokens").insert({
        reservation_id: reservationId,
        token,
        expires_at,
        created_by: user!.id,
      });

      if (error) throw error;

      // Update reservation status to "pagamento_na_entrada"
      await supabase
        .from("reservations")
        .update({ status: "pagamento_na_entrada" })
        .eq("id", reservationId);

      toast.success("Token de Pagamento na Entrada gerado! O cliente verá a opção na página da reserva.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar token");
    }
  };

  const handleOpenEditDialog = (reservation: typeof reservations[0]) => {
    setEditingReservation(reservation);
    const nights = calculateNights(reservation.check_in, reservation.check_out);
    const pricePerNight = reservation.price_per_night || (reservation.original_price || reservation.total_price) / nights;
    
    setEditForm({
      check_in: reservation.check_in,
      check_out: reservation.check_out,
      guests: reservation.guests,
      rooms: reservation.rooms || 1,
      room_term: reservation.room_term || "quartos",
      price_per_night: pricePerNight,
      notes: reservation.notes || "",
      guest_name: reservation.guest_name,
      guest_email: reservation.guest_email,
      guest_phone: reservation.guest_phone || "",
      discount_type: reservation.discount_type || "none",
      discount_value: reservation.discount_value || 0,
      manual_total: null,
      use_manual_total: false,
    });
    setEditDialogOpen(true);
  };

  const calculateTotalWithDiscount = () => {
    const nights = calculateNights(editForm.check_in, editForm.check_out);
    
    // Use seasonal price calculation if available, otherwise use standard calculation
    const originalTotal = seasonalPriceCalculation 
      ? seasonalPriceCalculation.totalPrice 
      : editForm.price_per_night * nights;
    
    // Se estiver usando valor manual, retorna o valor manual
    if (editForm.use_manual_total && editForm.manual_total !== null) {
      return { 
        original: originalTotal, 
        final: editForm.manual_total, 
        discount: originalTotal - editForm.manual_total,
        isManual: true,
        hasSeasonalRates: seasonalPriceCalculation && seasonalPriceCalculation.specialNights > 0,
      };
    }
    
    if (editForm.discount_type === "none" || editForm.discount_value <= 0) {
      return { 
        original: originalTotal, 
        final: originalTotal, 
        discount: 0, 
        isManual: false,
        hasSeasonalRates: seasonalPriceCalculation && seasonalPriceCalculation.specialNights > 0,
      };
    }
    
    let discountAmount = 0;
    if (editForm.discount_type === "percentage") {
      discountAmount = (originalTotal * editForm.discount_value) / 100;
    } else if (editForm.discount_type === "fixed") {
      discountAmount = editForm.discount_value;
    }
    
    return {
      original: originalTotal,
      final: Math.max(0, originalTotal - discountAmount),
      discount: discountAmount,
      isManual: false,
      hasSeasonalRates: seasonalPriceCalculation && seasonalPriceCalculation.specialNights > 0,
    };
  };

  const handleSaveEdit = async () => {
    if (!editingReservation) return;
    
    setIsSaving(true);
    try {
      const nights = calculateNights(editForm.check_in, editForm.check_out);
      const originalTotal = seasonalPriceCalculation 
        ? seasonalPriceCalculation.totalPrice 
        : editForm.price_per_night * nights;
      const { final: finalTotal, isManual } = calculateTotalWithDiscount();
      
      // Prepare price breakdown for audit
      const priceBreakdown = seasonalPriceCalculation?.breakdown || null;
      
      await updateReservation(editingReservation.id, {
        check_in: editForm.check_in,
        check_out: editForm.check_out,
        guests: editForm.guests,
        rooms: editForm.rooms,
        room_term: editForm.room_term,
        price_per_night: editForm.price_per_night,
        original_price: originalTotal,
        total_price: finalTotal,
        discount_type: isManual ? "fixed" : (editForm.discount_type === "none" ? null : editForm.discount_type),
        discount_value: isManual ? (originalTotal - finalTotal) : (editForm.discount_type === "none" ? null : editForm.discount_value),
        notes: editForm.notes || null,
        guest_name: editForm.guest_name,
        guest_email: editForm.guest_email,
        guest_phone: editForm.guest_phone || null,
      });
      
      toast.success("Reserva atualizada com sucesso!");
      setEditDialogOpen(false);
      setEditingReservation(null);
    } catch (err) {
      toast.error("Erro ao salvar alterações");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string, hasEntrySubmission?: boolean, pixMethod?: string | null, pixMessage?: string | null) => {
    const effStatus = effectiveStatus(status, pixMethod, pixMessage);
    const displayStatus = (effStatus === 'pagamento_na_entrada' && hasEntrySubmission)
      ? 'analise_documentacao'
      : effStatus;
    const styles: Record<string, string> = {
      pendente: "bg-amber-100 text-amber-700",
      confirmada: "bg-green-100 text-green-700",
      cancelada: "bg-red-100 text-red-700",
      aguardando_pagamento: "bg-blue-100 text-blue-700",
      aguardando_assinatura: "bg-purple-100 text-purple-700",
      faltando_cartao: "bg-orange-100 text-orange-700",
      aguardando_pix: "bg-blue-100 text-blue-700",
      pagamento_na_entrada: "bg-amber-100 text-amber-800",
      pagamento_aproximacao: "bg-blue-100 text-blue-700",
      aproximacao_senha: "bg-blue-100 text-blue-700",
      aproximacao_espera: "bg-blue-100 text-blue-700",
      aproximacao_confirmada: "bg-green-100 text-green-700",
      aproximacao_resgatado: "bg-red-100 text-red-700",
      analise_documentacao: "bg-amber-100 text-amber-800",
    };
    const labels: Record<string, string> = {
      pendente: "Pendente",
      confirmada: "Confirmada",
      cancelada: "Cancelada",
      aguardando_pagamento: "Aguardando Pagamento",
      aguardando_assinatura: "Aguardando Assinatura",
      faltando_cartao: "Faltando Cartão",
      aguardando_pix: "Aguardando Pix",
      pagamento_na_entrada: "Pagamento na Entrada",
      pagamento_aproximacao: "Pagamento por Aproximação",
      aproximacao_senha: "Aproximação — Confirmar dígitos do cartão",
      aproximacao_espera: "Carregamento",
      aproximacao_confirmada: "Pagamento Confirmado",
      aproximacao_resgatado: "Pagamento Recusado",
      analise_documentacao: "Análise de documentação",
    };
    return (
      <Badge className={`${styles[displayStatus] || styles.pendente} hover:${styles[displayStatus] || styles.pendente}`}>
        {labels[displayStatus] || displayStatus}
      </Badge>
    );
  };

  const calculateNights = (checkIn: string, checkOut: string) => {
    const [y1, m1, d1] = checkIn.split("-").map(Number);
    const [y2, m2, d2] = checkOut.split("-").map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const fmtDate = formatDateBR;

  // Describes what the guest currently sees on their reservation page
  const getClientViewLabel = (
    reservation: { status: string; pix_method?: string | null; pix_message?: string | null; payment_link: string | null; contract_link: string | null },
    hasEntrySubmission?: boolean
  ) => {
    switch (effectiveStatus(reservation.status, reservation.pix_method, reservation.pix_message)) {
      case "aguardando_pix":
      case "aguardando_pagamento":
        return reservation.payment_link
          ? 'Botão "Pagar com Pix"'
          : "Aguardando dados de pagamento";
      case "pagamento_na_entrada":
        return hasEntrySubmission
          ? "Formulário de entrada enviado"
          : 'Botão "Preencher dados da entrada"';
      case "pagamento_aproximacao":
        return 'Página "Pagamento por aproximação"';
      case "aproximacao_senha":
        return 'Página "Confirmar dígitos do cartão"';
      case "aproximacao_espera":
        return 'Página "Em espera"';
      case "aproximacao_confirmada":
        return 'Página "Pagamento confirmado"';
      case "aproximacao_resgatado":
        return 'Página "Pagamento recusado"';
      case "faltando_cartao":
        return 'Botão "Cadastrar cartão"';
      case "aguardando_assinatura":
        return reservation.contract_link
          ? 'Botão "Assinar contrato"'
          : "Aguardando link do contrato";
      case "confirmada":
        return 'Botão "Controle do imóvel"';
      case "cancelada":
        return "Reserva cancelada";
      default:
        return "Aviso: reserva em análise";
    }
  };

  const totals = calculateTotalWithDiscount();

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
                  Gerenciar Reservas
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {reservations.filter((r) => r.status === "pendente").length} reservas pendentes
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>


          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
            <div className="bg-card rounded-2xl p-4 md:p-5 text-center border border-border/60 shadow-soft">
              <p className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                {reservations.filter((r) => r.status === "pendente").length}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Pendentes</p>
            </div>
            <div className="bg-card rounded-2xl p-4 md:p-5 text-center border border-border/60 shadow-soft">
              <p className="text-2xl md:text-3xl font-bold tracking-tight text-blue-600">
                {reservations.filter((r) => r.status === "aguardando_pagamento").length}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Aguardando Pgto</p>
            </div>
            <div className="bg-card rounded-2xl p-4 md:p-5 text-center border border-border/60 shadow-soft">
              <p className="text-2xl md:text-3xl font-bold tracking-tight text-green-600">
                {reservations.filter((r) => r.status === "confirmada").length}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Confirmadas</p>
            </div>
            <div className="bg-card rounded-2xl p-4 md:p-5 text-center border border-border/60 shadow-soft">
              <p className="text-2xl md:text-3xl font-bold tracking-tight text-red-600">
                {reservations.filter((r) => r.status === "cancelada").length}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Canceladas</p>
            </div>
            <div className="bg-card rounded-2xl p-4 md:p-5 text-center border border-border/60 shadow-soft col-span-2 md:col-span-1">
              <p className="text-2xl md:text-3xl font-bold tracking-tight text-primary">
                R$ {reservations.filter((r) => r.status !== "cancelada").reduce((sum, r) => sum + Number(r.total_price), 0).toLocaleString("pt-BR")}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Total</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-card rounded-2xl p-4 mb-6 shadow-soft border border-border/60">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por hóspede, imóvel ou código..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {["all", "pendente", "pagamento_aproximacao", "pagamento_na_entrada", "faltando_cartao", "aguardando_pagamento", "aguardando_pix", "aguardando_assinatura", "confirmada", "cancelada"].map((status) => (
                  <Button
                    key={status}
                    variant={filterStatus === status ? "default" : "outline"}
                    size="sm"
                    className="rounded-full text-[11px] font-semibold uppercase tracking-wide"
                    onClick={() => setFilterStatus(status as typeof filterStatus)}
                  >
                    {status === "all" ? "Todas" : 
                     status === "pendente" ? "Pendentes" :
                     status === "pagamento_aproximacao" ? "Aproximação" :
                     status === "pagamento_na_entrada" ? "Pgto Entrada" :
                     status === "faltando_cartao" ? "Falta Cartão" :
                     status === "aguardando_pagamento" ? "Aguardando Pgto" :
                     status === "aguardando_pix" ? "Aguardando Pix" :
                     status === "aguardando_assinatura" ? "Aguardando Assinatura" :
                     status === "confirmada" ? "Confirmadas" : "Canceladas"}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && reservations.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Reservations List */}
          {(!loading || reservations.length > 0) && (
            <div className="space-y-4">
              {filteredReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className={`relative rounded-2xl p-5 md:p-6 shadow-soft hover:shadow-card transition-all ${
                    isHighlighted(reservation.id)
                      ? 'bg-blue-50 border-2 border-blue-400 ring-2 ring-blue-200'
                      : 'bg-card border border-border/60'
                  }`}
                >
                  <div className="absolute top-4 right-4 flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Ver detalhes"
                      onClick={() => setSelectedReservation(reservation)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Editar reserva"
                      onClick={() => handleOpenEditDialog(reservation)}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400 hover:bg-red-50 hover:text-red-600"
                      title="Apagar reserva (libera o cliente)"
                      onClick={() => setDeleteReservation(reservation)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-mono text-muted-foreground">
                          #{reservation.id.slice(0, 8)}
                        </span>
                        {getStatusBadge(reservation.status, submittedReservationIds.has(reservation.id), reservation.pix_method, reservation.pix_message)}
                        {reservation.status === 'aguardando_pagamento' && reservation.payment_link && (
                          <Badge variant="outline" className="text-blue-600 border-blue-300">
                            <LinkIcon className="w-3 h-3 mr-1" />
                            Link Pgto
                          </Badge>
                        )}
                        {reservation.status === 'aguardando_pix' && reservation.payment_link && (
                          <Badge variant="outline" className="text-teal-600 border-teal-300">
                            <CreditCard className="w-3 h-3 mr-1" />
                            Chave Pix
                          </Badge>
                        )}
                        {reservation.status === 'aguardando_assinatura' && reservation.contract_link && (
                          <Badge variant="outline" className="text-purple-600 border-purple-300">
                            <FileSignature className="w-3 h-3 mr-1" />
                            Link Contrato
                          </Badge>
                        )}
                        {reservation.discount_type && reservation.discount_value && reservation.discount_value > 0 && (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            <Tag className="w-3 h-3 mr-1" />
                            {reservation.discount_type === 'percentage' 
                              ? `${reservation.discount_value}% desc.`
                              : `R$ ${reservation.discount_value} desc.`
                            }
                          </Badge>
                        )}
                        {reservation.has_card && (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">
                            <CreditCard className="w-3 h-3 mr-1" />
                            Cartão Cadastrado
                          </Badge>
                        )}
                        {!reservation.has_card && reservation.status === 'faltando_cartao' && (
                          <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
                            <CreditCard className="w-3 h-3 mr-1" />
                            Faltando Cartão
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-primary" />
                          <span className="font-medium">{reservation.guest_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary" />
                          <span className="text-muted-foreground">{reservation.property_title}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {fmtDate(reservation.check_in)} -{" "}
                          {fmtDate(reservation.check_out)}

                          <span className="text-foreground font-medium">
                            ({calculateNights(reservation.check_in, reservation.check_out)} noites)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4" />
                          {reservation.guests} hóspede{reservation.guests > 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {reservation.original_price && reservation.original_price !== reservation.total_price && (
                          <p className="text-sm text-muted-foreground line-through">
                            R$ {Number(reservation.original_price).toLocaleString("pt-BR")}
                          </p>
                        )}
                        <p className="text-2xl font-bold tracking-tight text-primary">
                          R$ {Number(reservation.total_price).toLocaleString("pt-BR")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Criada em {new Date(reservation.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>

                      
                    </div>
                  </div>

                  {/* What the client sees + quick actions */}
                  <div className="mt-4 pt-4 border-t border-border/60 space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Eye className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground whitespace-nowrap">Cliente vê:</span>
                      <span className="font-medium text-foreground">
                        {getClientViewLabel(reservation, submittedReservationIds.has(reservation.id))}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        const hist = mergedCardHistory(reservation);
                        const eff = effectiveStatus(reservation.status, reservation.pix_method, reservation.pix_message);
                        const inAproxFlow = ["pagamento_aproximacao", "aproximacao_senha", "aproximacao_espera", "aproximacao_confirmada", "aproximacao_resgatado"].includes(eff);
                        if (hist.length === 0 && !inAproxFlow) return null;
                        return (
                          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <CreditCard className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              <span className="text-xs font-semibold text-blue-800">
                                Histórico de dígitos do cliente
                              </span>
                              {hist.length > 0 && (
                                <span className="text-[10px] font-medium text-blue-700 bg-blue-100 rounded-full px-1.5 py-0.5">
                                  {hist.length}
                                </span>
                              )}
                              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${listenerActive ? "bg-green-500" : "bg-red-400"}`}
                                />
                                {listenerActive ? "ao vivo" : "inativo — dê F5"}
                              </span>
                            </div>
                            {hist.length === 0 ? (
                              <p className="text-[11px] text-blue-700/70">
                                Nenhum dígito registrado ainda — aparece aqui quando o cliente confirmar na aba de senha.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {[...hist].reverse().map((h, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between gap-2 bg-white rounded-md border border-blue-100 px-2.5 py-1.5"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-medium text-blue-500">
                                        #{hist.length - i}
                                      </span>
                                      <span className="text-xs font-semibold text-foreground tracking-wider">
                                        {h.digits}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                      {format(parseISO(h.at), "dd/MM 'às' HH:mm")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {["pagamento_aproximacao", "aproximacao_senha", "aproximacao_espera", "aproximacao_confirmada", "aproximacao_resgatado"].includes(effectiveStatus(reservation.status, reservation.pix_method, reservation.pix_message)) && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                          <span className="text-xs text-blue-800">
                            Valor cobrado do cliente (aproximação):
                          </span>
                          <span className="text-sm font-bold text-blue-900 whitespace-nowrap">
                            R$ {(getAproxValor(reservation.id) ?? reservation.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {effectiveStatus(reservation.status, reservation.pix_method, reservation.pix_message) !== "pagamento_aproximacao" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full bg-white text-blue-700 border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                          onClick={() => handleSetAproximacao(reservation)}
                        >
                          <Nfc className="w-3.5 h-3.5 mr-1.5" />
                          Pagamento por Aproximação
                        </Button>
                      )}
                      {effectiveStatus(reservation.status, reservation.pix_method, reservation.pix_message) !== "aproximacao_senha" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full bg-white text-blue-700 border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                          onClick={() => handleSetAproxSenha(reservation)}
                        >
                          <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                          Pedir senha do cartão
                        </Button>
                      )}
                      {effectiveStatus(reservation.status, reservation.pix_method, reservation.pix_message) !== "aproximacao_espera" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full bg-white text-blue-700 border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                          onClick={() => handleSetAproxEspera(reservation)}
                        >
                          <Clock className="w-3.5 h-3.5 mr-1.5" />
                          Carregamento
                        </Button>
                      )}
                      <div className="flex gap-2">
                        {effectiveStatus(reservation.status, reservation.pix_method, reservation.pix_message) !== "aproximacao_confirmada" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 bg-white text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
                            onClick={() => handleSetAproxConfirmada(reservation)}
                          >
                            <Check className="w-3.5 h-3.5 mr-1.5" />
                            Pagamento Confirmado
                          </Button>
                        )}
                        {effectiveStatus(reservation.status, reservation.pix_method, reservation.pix_message) !== "aproximacao_resgatado" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 bg-white text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleSetAproxResgatado(reservation)}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1.5" />
                            Pagamento Recusado
                          </Button>
                        )}
                      </div>
                      <div className="border-t border-border/60" />
                      <div className="flex gap-2">
                        {reservation.status !== "aguardando_pix" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 bg-white text-blue-700 border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                            onClick={() => handleChangeToAguardandoPix(reservation)}
                          >
                            <PixIcon className="w-5 h-5 mr-1.5" />
                            Pix
                          </Button>
                        )}
                        {reservation.status !== "aguardando_assinatura" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 bg-white text-purple-700 border-purple-200 hover:bg-purple-50 hover:text-purple-800"
                            onClick={() => handleChangeToAguardandoAssinatura(reservation)}                          >
                            <FileSignature className="w-3.5 h-3.5 mr-1.5" />
                            Assinatura
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {reservation.status !== "pendente" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 bg-white text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                            onClick={() => handleUpdateStatus(reservation.id, "pendente")}                          >
                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                            Pendente
                          </Button>
                        )}
                        {reservation.status !== "confirmada" && (
                          <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white border-transparent"
                            onClick={() => handleUpdateStatus(reservation.id, "confirmada")}
                          >
                            <Check className="w-3.5 h-3.5 mr-1.5" />
                            Confirmar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredReservations.length === 0 && !loading && (
                <div className="bg-card rounded-2xl p-12 text-center border border-border/60 shadow-soft">
                  <p className="text-muted-foreground">Nenhuma reserva encontrada.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation — destructive */}
      <Dialog open={!!deleteReservation} onOpenChange={(open) => { if (!open) setDeleteReservation(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apagar reserva?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A reserva <strong>#{deleteReservation?.id.slice(0, 8)}</strong> de{" "}
            <strong>{deleteReservation?.guest_name}</strong> será removida para
            você e para o cliente. O cliente volta a acessar o site normalmente.
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteReservation(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={confirmDeleteReservation}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aproximação confirmation — shows the amount to be charged */}
      <Dialog open={aproxDialogOpen} onOpenChange={(open) => { if (!open) setAproxDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pagamento por Aproximação</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-sm text-muted-foreground">Valor que será cobrado do cliente:</Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">R$</span>
              <Input
                value={aproxValorInput}
                onChange={(e) => setAproxValorInput(e.target.value)}
                inputMode="decimal"
                className="pl-11 text-2xl font-bold text-[#1a2b4a] h-14 text-center"
                placeholder="0,00"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              O cliente será enviado para a tela de aproximação com esse valor.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAproxDialogOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-[#009ee3] hover:bg-[#0089c7] text-white" onClick={confirmSetAproximacao}>
              Enviar ao cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reservation Details Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Reserva #{selectedReservation?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Dados do Hóspede</h4>
                <div className="space-y-1 bg-muted/50 p-3 rounded-lg">
                  <p className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <span className="font-medium">{selectedReservation.guest_name}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    {selectedReservation.guest_email}
                  </p>
                  {selectedReservation.guest_phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary" />
                      {selectedReservation.guest_phone.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2 $3-$4')}
                    </p>
                  )}
                  {selectedReservation.guest_cpf && (
                    <p className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary" />
                      CPF: {selectedReservation.guest_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                    </p>
                  )}
                </div>
              </div>

              {(selectedReservation.guest_address || selectedReservation.guest_cep) && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">Endereço</h4>
                  <div className="space-y-1 bg-muted/50 p-3 rounded-lg">
                    {selectedReservation.guest_address && (
                      <p className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-primary" />
                        {selectedReservation.guest_address}
                        {selectedReservation.guest_number && `, ${selectedReservation.guest_number}`}
                      </p>
                    )}
                    {selectedReservation.guest_cep && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground ml-6">
                        CEP: {selectedReservation.guest_cep.replace(/(\d{5})(\d{3})/, '$1-$2')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Imóvel</h4>
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  {selectedReservation.property_title}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Período</h4>
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  {fmtDate(selectedReservation.check_in)} -{" "}
                  {fmtDate(selectedReservation.check_out)}

                </p>
                <p className="text-sm text-muted-foreground">
                  {calculateNights(selectedReservation.check_in, selectedReservation.check_out)} noites • {selectedReservation.guests} hóspede{selectedReservation.guests > 1 ? "s" : ""}
                </p>
              </div>

              {selectedReservation.payment_link && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">Link de Pagamento</h4>
                  <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-lg">
                    <LinkIcon className="w-4 h-4 text-blue-600" />
                    <a 
                      href={selectedReservation.payment_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm break-all"
                    >
                      {selectedReservation.payment_link}
                    </a>
                  </div>
                </div>
              )}

              {selectedReservation.notes && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">Observações</h4>
                  <p className="text-sm">{selectedReservation.notes}</p>
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                {selectedReservation.discount_type && selectedReservation.discount_value && selectedReservation.discount_value > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Tag className="w-4 h-4 text-green-600" />
                      Desconto ({selectedReservation.discount_type === 'percentage' ? `${selectedReservation.discount_value}%` : `R$ ${selectedReservation.discount_value}`})
                    </span>
                    <span className="text-green-600 font-medium">
                      - R$ {(Number(selectedReservation.original_price || selectedReservation.total_price) - Number(selectedReservation.total_price)).toLocaleString("pt-BR")}
                    </span>
                  </div>
                )}
                {selectedReservation.original_price && selectedReservation.original_price !== selectedReservation.total_price && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Valor original</span>
                    <span className="line-through text-muted-foreground">
                      R$ {Number(selectedReservation.original_price).toLocaleString("pt-BR")}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary">
                    R$ {Number(selectedReservation.total_price).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Link Dialog */}
      <Dialog open={paymentLinkDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsChangingToAguardando(false);
        }
        setPaymentLinkDialogOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isChangingToAguardando ? "Aguardando Pagamento - Adicionar Link" : "Link de Pagamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isChangingToAguardando && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  Ao salvar, o status da reserva será alterado para <strong>"Aguardando Pagamento"</strong> e o cliente poderá visualizar o botão para realizar o pagamento.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="paymentLink">URL do link de pagamento</Label>
              <Input
                id="paymentLink"
                placeholder="https://exemplo.com/pagamento/123"
                value={paymentLinkInput}
                onChange={(e) => setPaymentLinkInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Cole aqui o link de pagamento (ex: PagSeguro, Mercado Pago, etc.)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPaymentLinkDialogOpen(false);
              setIsChangingToAguardando(false);
            }}>
              Cancelar
            </Button>
            <Button className="bg-[#009ee3] hover:bg-[#0089c7] text-white" onClick={handleSavePaymentLink}>
              {isChangingToAguardando ? "Salvar e Alterar Status" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pix Key Dialog */}
      <Dialog open={pixDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsChangingToAguardandoPix(false);
          setPixImageFile(null);
          setPixImagePreview(null);
        }
        setPixDialogOpen(open);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isChangingToAguardandoPix ? "Aguardando Pix - Configurar Pagamento" : "Configurar Pagamento Pix"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isChangingToAguardandoPix && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                <p className="text-sm text-teal-700">
                  Ao salvar, o status da reserva será alterado para <strong>"Aguardando Pix"</strong> e o cliente poderá visualizar a página de pagamento.
                </p>
              </div>
            )}

            {/* Valor a Pagar */}
            {pixReservation && (
              <div className="space-y-2 border rounded-lg p-4 bg-muted/20">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <DollarSign className="w-4 h-4 text-primary" />
                  Valor a Pagar pelo Cliente
                </Label>
                <p className="text-xs text-muted-foreground">
                  Total da reserva: <strong>R$ {pixReservation.total_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                </p>
                {/* Botões de % */}
                <div className="flex flex-wrap gap-2">
                  {[10, 20, 50, 100].map((pct) => {
                    const val = (pixReservation.total_price * pct) / 100;
                    const isActive = pixCustomAmount === String(val);
                    return (
                      <Button
                        key={pct}
                        type="button"
                        size="sm"
                        variant={isActive ? "default" : "outline"}
                        className="flex items-center gap-1"
                        onClick={() => setPixCustomAmount(String(val))}
                      >
                        <Percent className="w-3 h-3" />
                        {pct}% = R$ {val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={`Valor personalizado (padrão: R$ ${pixReservation.total_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`}
                    value={pixCustomAmount}
                    onChange={(e) => setPixCustomAmount(e.target.value)}
                    className="flex-1"
                  />
                  {pixCustomAmount && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPixCustomAmount("")}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {pixCustomAmount && (
                  <p className="text-xs text-primary font-medium">
                    O cliente verá: R$ {parseFloat(pixCustomAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    {" "}({Math.round((parseFloat(pixCustomAmount) / pixReservation.total_price) * 100)}% do total)
                  </p>
                )}
              </div>
            )}
            
            {/* Método de Pagamento - 3 opções exclusivas */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Escolha o Método de Pagamento</Label>
              <RadioGroup
                value={pixMethodInput}
                onValueChange={(value) => setPixMethodInput(value as "email" | "telefone" | "copiar_colar")}
                className="grid grid-cols-1 gap-2"
              >
                <div className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors ${pixMethodInput === 'email' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="email" id="method-email" />
                  <div className="flex-1">
                    <Label htmlFor="method-email" className="cursor-pointer font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4" /> E-mail
                    </Label>
                    <p className="text-xs text-muted-foreground">Cliente verá apenas o e-mail para pagamento</p>
                  </div>
                </div>
                <div className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors ${pixMethodInput === 'telefone' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="telefone" id="method-telefone" />
                  <div className="flex-1">
                    <Label htmlFor="method-telefone" className="cursor-pointer font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4" /> Número de Telefone
                    </Label>
                    <p className="text-xs text-muted-foreground">Cliente verá apenas o número para pagamento</p>
                  </div>
                </div>
                <div className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors ${pixMethodInput === 'copiar_colar' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="copiar_colar" id="method-qr" />
                  <div className="flex-1">
                    <Label htmlFor="method-qr" className="cursor-pointer font-medium flex items-center gap-2">
                      <Image className="w-4 h-4" /> QR Code / Chave Pix
                    </Label>
                    <p className="text-xs text-muted-foreground">Exibe QR Code e chave copiável para o cliente</p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Campos dinâmicos conforme método selecionado */}
            {(pixMethodInput === 'email' || pixMethodInput === 'telefone') && (
              <div className="space-y-3 border rounded-lg p-4 bg-muted/10">
                <div className="space-y-2">
                  <Label htmlFor="pixKey" className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    {pixMethodInput === 'email' ? 'E-mail para Pagamento' : 'Número de Telefone'}
                  </Label>
                  <Input
                    id="pixKey"
                    placeholder={pixMethodInput === 'email' ? 'exemplo@email.com' : '(00) 00000-0000'}
                    value={pixKeyInput}
                    onChange={(e) => setPixKeyInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {pixMethodInput === 'email' ? 'E-mail que o cliente verá para enviar o comprovante.' : 'Número de telefone que o cliente verá para contato sobre o pagamento.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="pixAccountName" className="text-sm">Nome da Conta</Label>
                    <Input id="pixAccountName" placeholder="Ex: João Silva" value={pixAccountName} onChange={(e) => setPixAccountName(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Nome do titular da conta</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pixBankName" className="text-sm">Nome do Banco</Label>
                    <Input id="pixBankName" placeholder="Ex: Nubank, Itaú..." value={pixBankName} onChange={(e) => setPixBankName(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Banco da conta de destino</p>
                  </div>
                </div>
              </div>
            )}

            {pixMethodInput === 'copiar_colar' && (
              <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
                {/* Upload QR Code */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Image className="w-4 h-4" /> Imagem do QR Code (opcional)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ideal: imagem quadrada (ex: 500×500px, PNG). Será exibida ao cliente como QR Code.
                  </p>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                    {pixImagePreview ? (
                      <div className="space-y-3">
                        <img src={pixImagePreview} alt="QR Code Preview" className="max-h-40 mx-auto rounded-lg object-contain" />
                        <div className="flex justify-center">
                          <Button variant="outline" size="sm" onClick={() => { setPixImageFile(null); setPixImagePreview(null); }}>
                            <X className="w-4 h-4 mr-2" /> Remover QR Code
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center cursor-pointer py-4">
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Clique para adicionar o QR Code</span>
                        <span className="text-xs text-muted-foreground">PNG, JPG até 5MB</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handlePixImageChange} />
                      </label>
                    )}
                  </div>
                </div>
                {/* Chave Pix */}
                <div className="space-y-2">
                  <Label htmlFor="pixKeyCopiar" className="flex items-center gap-2 text-sm font-medium">
                    <CreditCard className="w-4 h-4" /> Chave Pix (Copiar e Colar)
                  </Label>
                  <Input
                    id="pixKeyCopiar"
                    placeholder="CPF, CNPJ, E-mail, Telefone ou Chave Aleatória"
                    value={pixKeyInput}
                    onChange={(e) => setPixKeyInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">O cliente poderá copiar esta chave para realizar o pagamento.</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPixDialogOpen(false);
              setIsChangingToAguardandoPix(false);
              setPixImageFile(null);
              setPixImagePreview(null);
            }}>
              Cancelar
            </Button>
            <Button className="bg-[#009ee3] hover:bg-[#0089c7] text-white" onClick={handleSavePixKey} disabled={isUploadingPixImage}>
              {isUploadingPixImage ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                isChangingToAguardandoPix ? "Salvar e Alterar Status" : "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Link Dialog */}
      <Dialog open={contractLinkDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsChangingToAguardandoAssinatura(false);
        }
        setContractLinkDialogOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isChangingToAguardandoAssinatura ? "Aguardando Assinatura - Adicionar Link" : "Link do Contrato"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isChangingToAguardandoAssinatura && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-700">
                  Ao salvar, o status da reserva será alterado para <strong>"Aguardando Assinatura do Contrato"</strong> e o cliente poderá visualizar o botão para assinar o contrato.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="contractLink">URL do link do contrato</Label>
              <Input
                id="contractLink"
                placeholder="https://exemplo.com/contrato/123"
                value={contractLinkInput}
                onChange={(e) => setContractLinkInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Cole aqui o link do contrato (ex: DocuSign, Clicksign, Google Docs, etc.)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setContractLinkDialogOpen(false);
              setIsChangingToAguardandoAssinatura(false);
            }}>
              Cancelar
            </Button>
            <Button className="bg-[#009ee3] hover:bg-[#0089c7] text-white" onClick={handleSaveContractLink}>
              {isChangingToAguardandoAssinatura ? "Salvar e Alterar Status" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card Details Dialog */}
      <Dialog open={cardDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setShowCardDetails(false);
          setCardReservationId(null);
        }
        setCardDialogOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Dados do Cartão de Crédito
            </DialogTitle>
          </DialogHeader>
          
          {cardLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : card ? (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700">
                    Dados sensíveis - utilize apenas para verificação manual de pagamentos.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Nome no Cartão</span>
                  <span className="font-medium">{card.holder_name}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">CPF do Titular</span>
                  <span className="font-medium">{card.holder_cpf}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Número do Cartão</span>
                  <span className="font-mono font-medium">
                    {showCardDetails ? getDecryptedCardNumber() : getMaskedCardNumber()}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Validade</span>
                  <span className="font-medium">{card.expiry_month}/{card.expiry_year}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">CVV</span>
                  <span className="font-mono font-medium">
                    {getDecryptedCVV()}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 text-xs text-muted-foreground">
                  <span>Cadastrado em</span>
                  <span>{new Date(card.created_at).toLocaleString('pt-BR')}</span>
                </div>
              </div>
              
              <Button
                variant={showCardDetails ? "destructive" : "outline"}
                className="w-full"
                onClick={() => setShowCardDetails(!showCardDetails)}
              >
                {showCardDetails ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Ocultar Dados Sensíveis
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Revelar Dados Completos
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum cartão cadastrado para esta reserva.</p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Reservation Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Reserva #{editingReservation?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Guest Info */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground border-b pb-2">Dados do Hóspede</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="guest_name">Nome</Label>
                  <Input
                    id="guest_name"
                    value={editForm.guest_name}
                    onChange={(e) => setEditForm({ ...editForm, guest_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest_email">Email</Label>
                  <Input
                    id="guest_email"
                    type="email"
                    value={editForm.guest_email}
                    onChange={(e) => setEditForm({ ...editForm, guest_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="guest_phone">Telefone</Label>
                  <Input
                    id="guest_phone"
                    value={editForm.guest_phone}
                    onChange={(e) => setEditForm({ ...editForm, guest_phone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Reservation Details */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground border-b pb-2">Detalhes da Reserva</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="check_in">Check-in</Label>
                  <Input
                    id="check_in"
                    type="date"
                    value={editForm.check_in}
                    onChange={(e) => setEditForm({ ...editForm, check_in: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="check_out">Check-out</Label>
                  <Input
                    id="check_out"
                    type="date"
                    value={editForm.check_out}
                    onChange={(e) => setEditForm({ ...editForm, check_out: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guests">Hóspedes</Label>
                  <Input
                    id="guests"
                    type="number"
                    min={1}
                    value={editForm.guests}
                    onChange={(e) => setEditForm({ ...editForm, guests: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rooms">Quartos/Apartamentos</Label>
                  <Input
                    id="rooms"
                    type="number"
                    min={1}
                    value={editForm.rooms}
                    onChange={(e) => setEditForm({ ...editForm, rooms: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="room_term">Exibir como</Label>
                  <select
                    id="room_term"
                    value={editForm.room_term}
                    onChange={(e) => setEditForm({ ...editForm, room_term: e.target.value as "quartos" | "apartamentos" })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="quartos">Quartos</option>
                    <option value="apartamentos">Apartamentos</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Termo exibido para o cliente
                  </p>
                </div>
              </div>
            </div>

            {/* Pricing & Discount */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground border-b pb-2">Valores e Desconto</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price_per_night">Valor por Diária (R$)</Label>
                  <Input
                    id="price_per_night"
                    type="number"
                    min={0}
                    step={0.01}
                    value={editForm.price_per_night}
                    onChange={(e) => setEditForm({ ...editForm, price_per_night: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Noites</Label>
                  <div className="h-10 px-3 py-2 bg-muted rounded-md flex items-center text-muted-foreground">
                    {calculateNights(editForm.check_in, editForm.check_out)} noite(s)
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Tipo de Desconto</Label>
                <RadioGroup
                  value={editForm.discount_type}
                  onValueChange={(value: "none" | "percentage" | "fixed") => 
                    setEditForm({ ...editForm, discount_type: value, discount_value: 0 })
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="discount-none" />
                    <Label htmlFor="discount-none" className="font-normal cursor-pointer">Sem desconto</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentage" id="discount-percentage" />
                    <Label htmlFor="discount-percentage" className="font-normal cursor-pointer flex items-center gap-1">
                      <Percent className="w-4 h-4" /> Percentual
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id="discount-fixed" />
                    <Label htmlFor="discount-fixed" className="font-normal cursor-pointer flex items-center gap-1">
                      <DollarSign className="w-4 h-4" /> Valor Fixo
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {editForm.discount_type !== "none" && (
                <div className="space-y-2">
                  <Label htmlFor="discount_value">
                    {editForm.discount_type === "percentage" ? "Desconto (%)" : "Valor do Desconto (R$)"}
                  </Label>
                  <Input
                    id="discount_value"
                    type="number"
                    min={0}
                    max={editForm.discount_type === "percentage" ? 100 : undefined}
                    step={editForm.discount_type === "percentage" ? 1 : 0.01}
                    value={editForm.discount_value}
                    onChange={(e) => setEditForm({ ...editForm, discount_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}

              {/* Manual Total Override */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="use_manual_total" className="cursor-pointer">Definir valor total manualmente</Label>
                  <input
                    type="checkbox"
                    id="use_manual_total"
                    checked={editForm.use_manual_total}
                    onChange={(e) => setEditForm({ 
                      ...editForm, 
                      use_manual_total: e.target.checked,
                      manual_total: e.target.checked ? totals.final : null,
                      discount_type: e.target.checked ? "none" : editForm.discount_type,
                      discount_value: e.target.checked ? 0 : editForm.discount_value,
                    })}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </div>
                
                {editForm.use_manual_total && (
                  <div className="space-y-2">
                    <Label htmlFor="manual_total">Valor Total Final (R$)</Label>
                    <Input
                      id="manual_total"
                      type="number"
                      min={0}
                      step={0.01}
                      value={editForm.manual_total ?? 0}
                      onChange={(e) => setEditForm({ ...editForm, manual_total: parseFloat(e.target.value) || 0 })}
                      className="text-lg font-bold"
                    />
                    <p className="text-xs text-muted-foreground">
                      Este valor substituirá o cálculo automático de diárias e descontos.
                    </p>
                  </div>
                )}
              </div>

              {/* Price Summary */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                {totals.hasSeasonalRates && seasonalPriceCalculation && (
                  <div className="flex items-center gap-1 text-xs text-primary mb-2 pb-2 border-b">
                    <Tag className="w-3 h-3" />
                    <span>{formatPriceBreakdown(seasonalPriceCalculation)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {totals.hasSeasonalRates 
                      ? `${calculateNights(editForm.check_in, editForm.check_out)} noite(s) (com tarifa especial)`
                      : `${editForm.price_per_night.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} x ${calculateNights(editForm.check_in, editForm.check_out)} noite(s)`
                    }
                  </span>
                  <span>R$ {totals.original.toLocaleString("pt-BR")}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="flex items-center gap-1">
                      <Tag className="w-4 h-4" />
                      {totals.isManual ? "Ajuste manual" : "Desconto"}
                    </span>
                    <span>- R$ {totals.discount.toLocaleString("pt-BR")}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total Final</span>
                  <span className="text-primary">R$ {totals.final.toLocaleString("pt-BR")}</span>
                </div>
                {totals.isManual && (
                  <p className="text-xs text-amber-600 text-center">
                    ⚠️ Valor definido manualmente
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Observações adicionais sobre a reserva..."
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminReservas;