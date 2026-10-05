import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isWithinInterval, startOfDay, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Sun,
  Calendar,
  Percent,
  DollarSign,
  TrendingUp,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  useAllSeasonalRates,
  useSeasonalRateMutations,
  SeasonalRateWithProperty,
  SeasonalRateInput,
} from "@/hooks/useSeasonalRates";

interface AdminProperty {
  id: string;
  title: string;
  type: "flat" | "apartamento";
  city: string | null;
  neighborhood: string | null;
  price_per_night: number;
  is_active: boolean;
}

type PriceMode = "percent" | "fixed";

// One editable suggestion returned by the AI, before it becomes a real rate
interface AiSuggestion {
  nome: string;
  data_inicio: string;
  data_fim: string;
  aumento: number;
}

const fmtDate = (d: string) => format(parseISO(d), "dd/MM/yyyy", { locale: ptBR });
const fmtMoney = (v: number) =>
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

const AdminAltaTemporada = () => {
  const { data: rates, isLoading } = useAllSeasonalRates();
  const { createRate, updateRate, deleteRate } = useSeasonalRateMutations();

  // All properties (including inactive) for the picker
  const { data: properties } = useQuery({
    queryKey: ["admin-properties-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, type, city, neighborhood, price_per_night, is_active")
        .order("title", { ascending: true });
      if (error) throw error;
      return data as AdminProperty[];
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<SeasonalRateWithProperty | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterProperty, setFilterProperty] = useState("all");

  const [formData, setFormData] = useState({
    property_id: "",
    label: "",
    start_date: "",
    end_date: "",
    mode: "percent" as PriceMode,
    percentage: "",
    daily_price: "",
  });

  // ── AI generation state ──
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiStep, setAiStep] = useState<"form" | "review">("form");
  const [aiPropertyId, setAiPropertyId] = useState("");
  const [aiYear, setAiYear] = useState(String(new Date().getFullYear()));
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);

  const aiProperty = properties?.find((p) => p.id === aiPropertyId);
  const aiBasePrice = aiProperty ? Number(aiProperty.price_per_night) : 0;

  // Properties that already have rates overlapping the chosen year are excluded
  // from the AI picker (avoids generating duplicate seasons for the same year).
  const aiYearNum = parseInt(aiYear, 10);
  const configuredPropertyIds = useMemo(() => {
    const set = new Set<string>();
    if (!rates || !Number.isInteger(aiYearNum)) return set;
    const yStart = `${aiYearNum}-01-01`;
    const yEnd = `${aiYearNum}-12-31`;
    for (const r of rates) {
      if (r.start_date <= yEnd && r.end_date >= yStart) set.add(r.property_id);
    }
    return set;
  }, [rates, aiYearNum]);

  const aiAvailableProperties = useMemo(
    () => (properties || []).filter((p) => !configuredPropertyIds.has(p.id)),
    [properties, configuredPropertyIds]
  );
  const aiConfiguredCount = (properties?.length ?? 0) - aiAvailableProperties.length;

  // Clear the selection if the chosen property becomes configured for the new year
  useEffect(() => {
    if (aiPropertyId && configuredPropertyIds.has(aiPropertyId)) setAiPropertyId("");
  }, [aiPropertyId, configuredPropertyIds]);

  const resetAiDialog = () => {
    setAiStep("form");
    setAiPropertyId("");
    setAiYear(String(new Date().getFullYear()));
    setAiGenerating(false);
    setAiSaving(false);
    setAiError(null);
    setAiSuggestions([]);
  };

  const handleGenerate = async () => {
    if (!aiProperty) {
      toast.error("Selecione o imóvel");
      return;
    }
    const year = parseInt(aiYear, 10);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      toast.error("Informe um ano válido");
      return;
    }

    setAiGenerating(true);
    setAiError(null);

    console.log("[AltaTemporadaAI] Gerando tarifas", {
      property: aiProperty.title,
      year,
    });

    try {
      const { data, error } = await supabase.functions.invoke("generate-seasonal-rates", {
        body: {
          property: {
            title: aiProperty.title,
            type: aiProperty.type,
            city: aiProperty.city,
            neighborhood: aiProperty.neighborhood,
          },
          year,
        },
      });

      if (error) {
        // FunctionsHttpError carries the raw Response in `context`
        const ctx = (error as { context?: Response }).context;
        const status = ctx?.status;
        let msg = "Erro ao gerar tarifas";
        try {
          const body = await ctx?.json();
          if (body?.error) msg = String(body.error);
          else if (body?.message) msg = String(body.message);
        } catch { /* keep generic message */ }

        console.error("[AltaTemporadaAI] Falha na função", { status, message: error.message, detail: msg });

        if (status === 404) {
          msg = "Função de IA não encontrada no servidor — o deploy da edge function 'generate-seasonal-rates' ainda não foi feito.";
        } else if (status === 401 || status === 403) {
          msg = "Sessão expirada ou sem permissão de administrador. Faça login novamente.";
        }
        setAiError(msg);
        return;
      }

      if (data?.error) {
        setAiError(String(data.error));
        return;
      }

      const list = (data?.tarifas ?? []) as AiSuggestion[];
      if (list.length === 0) {
        setAiError("A IA não retornou tarifas válidas. Tente novamente.");
        return;
      }

      console.log("[AltaTemporadaAI] Tarifas recebidas:", list.length);
      setAiSuggestions(list.map((s) => ({ ...s })));
      setAiStep("review");
    } catch (err) {
      console.error("[AltaTemporadaAI] Erro inesperado:", err);
      setAiError("Falha ao conectar com a IA. Tente novamente.");
    } finally {
      setAiGenerating(false);
    }
  };

  const updateSuggestion = (index: number, patch: Partial<AiSuggestion>) => {
    setAiSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  };

  const removeSuggestion = (index: number) => {
    setAiSuggestions((prev) => prev.filter((_, i) => i !== index));
  };

  // Saves every approved suggestion through the SAME mechanism used by
  // the manual "Nova Tarifa" dialog (insert into seasonal_rates)
  const handleSaveAll = async () => {
    if (!aiProperty) return;

    const invalid = aiSuggestions.find(
      (s) =>
        !s.nome.trim() ||
        !s.data_inicio ||
        !s.data_fim ||
        s.data_fim < s.data_inicio ||
        !isFinite(s.aumento) ||
        s.aumento <= 0
    );
    if (invalid) {
      toast.error(`Revise a tarifa "${invalid.nome || "sem nome"}": dados inválidos`);
      return;
    }
    if (aiSuggestions.length === 0) {
      toast.error("Nenhuma tarifa para salvar");
      return;
    }

    setAiSaving(true);
    try {
      const results = await Promise.allSettled(
        aiSuggestions.map((s) =>
          createRate.mutateAsync({
            property_id: aiProperty.id,
            start_date: s.data_inicio,
            end_date: s.data_fim,
            daily_price: Math.round(aiBasePrice * (1 + s.aumento / 100)),
            label: s.nome.trim(),
          })
        )
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      const saved = results.length - failed;

      if (failed > 0) {
        toast.error(
          saved > 0
            ? `${saved} tarifa(s) salva(s), ${failed} falharam. Verifique a listagem.`
            : "Erro ao salvar as tarifas"
        );
        return; // keep the review open so nothing is "lost"
      }

      toast.success(`${saved} tarifa(s) de alta temporada cadastradas!`);
      setAiDialogOpen(false);
      resetAiDialog();
    } catch (err) {
      console.error("Save all error:", err);
      toast.error("Erro ao salvar as tarifas");
    } finally {
      setAiSaving(false);
    }
  };

  const selectedProperty = properties?.find((p) => p.id === formData.property_id);
  const basePrice = selectedProperty ? Number(selectedProperty.price_per_night) : 0;

  // Final daily price: either computed from the % markup or entered directly
  const computedPrice = useMemo(() => {
    if (formData.mode === "percent") {
      const pct = parseFloat(formData.percentage);
      if (!basePrice || isNaN(pct)) return 0;
      return Math.round(basePrice * (1 + pct / 100));
    }
    return Math.round(parseFloat(formData.daily_price) || 0);
  }, [formData.mode, formData.percentage, formData.daily_price, basePrice]);

  const pctDiff = (rate: SeasonalRateWithProperty) => {
    const base = rate.property ? Number(rate.property.price_per_night) : 0;
    if (!base) return null;
    return Math.round((Number(rate.daily_price) / base - 1) * 100);
  };

  const isActiveNow = (rate: SeasonalRateWithProperty) =>
    isWithinInterval(startOfDay(new Date()), {
      start: startOfDay(parseISO(rate.start_date)),
      end: startOfDay(parseISO(rate.end_date)),
    });

  const nights = (rate: SeasonalRateWithProperty) =>
    Math.max(
      1,
      differenceInCalendarDays(parseISO(rate.end_date), parseISO(rate.start_date))
    );

  const filteredRates = useMemo(() => {
    const list = rates || [];
    return filterProperty === "all"
      ? list
      : list.filter((r) => r.property_id === filterProperty);
  }, [rates, filterProperty]);

  const stats = useMemo(() => {
    const list = rates || [];
    return {
      total: list.length,
      properties: new Set(list.map((r) => r.property_id)).size,
      activeNow: list.filter(isActiveNow).length,
    };
  }, [rates]);

  const resetForm = () => {
    setFormData({
      property_id: "",
      label: "",
      start_date: "",
      end_date: "",
      mode: "percent",
      percentage: "",
      daily_price: "",
    });
    setEditingRate(null);
  };

  const handleOpenDialog = (rate?: SeasonalRateWithProperty) => {
    if (rate) {
      setEditingRate(rate);
      setFormData({
        property_id: rate.property_id,
        label: rate.label || "",
        start_date: rate.start_date,
        end_date: rate.end_date,
        mode: "fixed",
        percentage: "",
        daily_price: String(Number(rate.daily_price)),
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.property_id) {
      toast.error("Selecione o imóvel");
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      toast.error("Selecione as datas de início e fim");
      return;
    }
    if (formData.end_date < formData.start_date) {
      toast.error("A data de fim deve ser igual ou posterior à data de início");
      return;
    }
    if (computedPrice <= 0) {
      toast.error(
        formData.mode === "percent"
          ? "Informe a porcentagem de aumento"
          : "Informe o valor da diária"
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload: SeasonalRateInput = {
        property_id: formData.property_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        daily_price: computedPrice,
        label: formData.label.trim() || null,
      };

      if (editingRate) {
        await updateRate.mutateAsync({ id: editingRate.id, ...payload });
        toast.success("Tarifa atualizada com sucesso!");
      } else {
        await createRate.mutateAsync(payload);
        toast.success("Tarifa de alta temporada cadastrada!");
      }

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving rate:", error);
      toast.error("Erro ao salvar tarifa");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (rate: SeasonalRateWithProperty) => {
    if (!confirm(`Excluir tarifa de ${fmtDate(rate.start_date)} - ${fmtDate(rate.end_date)}?`)) return;
    try {
      await deleteRate.mutateAsync(rate.id);
      toast.success("Tarifa removida com sucesso!");
    } catch (error) {
      console.error("Error deleting rate:", error);
      toast.error("Erro ao remover tarifa");
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
                  Alta Temporada
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Tarifas especiais por período para os imóveis
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setAiDialogOpen(true)}>
              <Sparkles className="w-4 h-4 mr-2" />
              Gerar com IA
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button variant="gold" className="rounded-xl" onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Tarifa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingRate ? "Editar Tarifa" : "Nova Tarifa de Alta Temporada"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Property */}
                  <div className="space-y-2">
                    <Label>Imóvel</Label>
                    <Select
                      value={formData.property_id}
                      onValueChange={(v) => setFormData((prev) => ({ ...prev, property_id: v }))}
                      disabled={!!editingRate}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o imóvel" />
                      </SelectTrigger>
                      <SelectContent>
                        {(properties || []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title} — {fmtMoney(p.price_per_night)}/diária
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Label */}
                  <div className="space-y-2">
                    <Label htmlFor="rate-label">Nome da tarifa (opcional)</Label>
                    <Input
                      id="rate-label"
                      placeholder="Ex: Réveillon, Carnaval, Feriado..."
                      value={formData.label}
                      onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}
                    />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Data Início</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date">Data Fim</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Pricing mode */}
                  <div className="space-y-2">
                    <Label>Como definir o preço</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, mode: "percent" }))}
                        className={cn(
                          "flex items-center justify-center gap-2 h-11 rounded-lg border text-sm font-medium transition-colors",
                          formData.mode === "percent"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input bg-background text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <Percent className="w-4 h-4" />
                        Aumento %
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, mode: "fixed" }))}
                        className={cn(
                          "flex items-center justify-center gap-2 h-11 rounded-lg border text-sm font-medium transition-colors",
                          formData.mode === "fixed"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input bg-background text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <DollarSign className="w-4 h-4" />
                        Valor fixo
                      </button>
                    </div>
                  </div>

                  {formData.mode === "percent" ? (
                    <div className="space-y-2">
                      <Label htmlFor="percentage">Porcentagem de aumento (%)</Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="percentage"
                          type="number"
                          min="0"
                          step="1"
                          className="pl-9"
                          placeholder="Ex: 30"
                          value={formData.percentage}
                          onChange={(e) => setFormData((prev) => ({ ...prev, percentage: e.target.value }))}
                        />
                      </div>
                      {selectedProperty && computedPrice > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Diária: {fmtMoney(basePrice)} →{" "}
                          <span className="font-semibold text-primary">{fmtMoney(computedPrice)}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="daily_price">Valor da Diária (R$)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="daily_price"
                          type="number"
                          min="0"
                          step="1"
                          className="pl-9"
                          value={formData.daily_price}
                          onChange={(e) => setFormData((prev) => ({ ...prev, daily_price: e.target.value }))}
                        />
                      </div>
                      {selectedProperty && computedPrice > 0 && basePrice > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {computedPrice >= basePrice ? "+" : ""}
                          {Math.round((computedPrice / basePrice - 1) * 100)}% em relação à diária padrão ({fmtMoney(basePrice)})
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button variant="gold" onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingRate ? "Atualizar" : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* AI Generation Dialog */}
            <Dialog open={aiDialogOpen} onOpenChange={(open) => {
              setAiDialogOpen(open);
              if (!open) resetAiDialog();
            }}>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Gerar Tarifas de Alta Temporada
                  </DialogTitle>
                </DialogHeader>

                {aiStep === "form" ? (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="ai-year">Ano</Label>
                      <Input
                        id="ai-year"
                        type="number"
                        min="2000"
                        max="2100"
                        step="1"
                        placeholder="2027"
                        value={aiYear}
                        onChange={(e) => setAiYear(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Imóvel</Label>
                      <Select value={aiPropertyId} onValueChange={setAiPropertyId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o imóvel" />
                        </SelectTrigger>
                        <SelectContent>
                          {aiAvailableProperties.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.title} — {fmtMoney(p.price_per_night)}/diária
                            </SelectItem>
                          ))}
                          {aiAvailableProperties.length === 0 && (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              Nenhum imóvel disponível
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      {aiConfiguredCount > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          {aiConfiguredCount} imóvel(is) já possui(em) tarifas em {aiYearNum} e não aparecem na lista.
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      A IA vai sugerir os principais períodos de alta procura (férias,
                      feriados e datas regionais) com percentuais de aumento. Você poderá
                      revisar e editar tudo antes de salvar.
                    </p>

                    {aiError && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                        <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-destructive">{aiError}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                      {aiSuggestions.length} tarifa(s) sugerida(s) para{" "}
                      <span className="font-medium text-foreground">{aiProperty?.title}</span>.
                      Revise e edite antes de salvar.
                    </p>

                    <div className="space-y-3">
                      {aiSuggestions.map((s, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-border/60 bg-muted/40 p-3 space-y-3"
                        >
                          <div className="flex items-center gap-2">
                            <Input
                              className="h-9 font-medium bg-card"
                              value={s.nome}
                              onChange={(e) => updateSuggestion(index, { nome: e.target.value })}
                              placeholder="Nome da tarifa"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                              onClick={() => removeSuggestion(index)}
                              title="Remover sugestão"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Início</Label>
                              <Input
                                type="date"
                                className="h-9 bg-card text-sm"
                                value={s.data_inicio}
                                onChange={(e) => updateSuggestion(index, { data_inicio: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Fim</Label>
                              <Input
                                type="date"
                                className="h-9 bg-card text-sm"
                                value={s.data_fim}
                                onChange={(e) => updateSuggestion(index, { data_fim: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Aumento (%)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                className="h-9 bg-card text-sm"
                                value={s.aumento}
                                onChange={(e) => updateSuggestion(index, { aumento: Number(e.target.value) })}
                              />
                            </div>
                          </div>
                          {aiBasePrice > 0 && isFinite(s.aumento) && s.aumento > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Diária: {fmtMoney(aiBasePrice)} →{" "}
                              <span className="font-semibold text-primary">
                                {fmtMoney(Math.round(aiBasePrice * (1 + s.aumento / 100)))}
                              </span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <DialogFooter>
                  {aiStep === "form" ? (
                    <>
                      <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button variant="gold" onClick={handleGenerate} disabled={aiGenerating || !aiPropertyId}>
                        {aiGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Gerando tarifas...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Gerar Alta Temporada
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setAiStep("form")}
                        disabled={aiSaving}
                      >
                        Voltar
                      </Button>
                      <Button
                        variant="gold"
                        onClick={handleSaveAll}
                        disabled={aiSaving || aiSuggestions.length === 0}
                      >
                        {aiSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Salvando tarifas...
                          </>
                        ) : (
                          `Salvar todas as tarifas (${aiSuggestions.length})`
                        )}
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
            <div className="bg-card rounded-2xl p-4 md:p-5 text-center border border-border/60 shadow-soft">
              <p className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{stats.total}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Tarifas</p>
            </div>
            <div className="bg-card rounded-2xl p-4 md:p-5 text-center border border-border/60 shadow-soft">
              <p className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{stats.properties}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Imóveis</p>
            </div>
            <div className="bg-card rounded-2xl p-4 md:p-5 text-center border border-border/60 shadow-soft">
              <p className="text-2xl md:text-3xl font-bold tracking-tight text-primary">{stats.activeNow}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Ativas agora</p>
            </div>
          </div>

          {/* Filter */}
          <div className="bg-card rounded-2xl p-4 mb-6 shadow-soft border border-border/60">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <Select value={filterProperty} onValueChange={setFilterProperty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os imóveis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os imóveis</SelectItem>
                    {(properties || []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                {filteredRates.length} tarifa{filteredRates.length === 1 ? "" : "s"} cadastrada{filteredRates.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredRates.length === 0 ? (
            <div className="bg-card rounded-2xl p-12 text-center border border-border/60 shadow-soft">
              <Sun className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                Nenhuma tarifa cadastrada
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Cadastre tarifas de alta temporada para aumentar as diárias em datas de alta procura.
              </p>
              <Button variant="gold" onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Primeira Tarifa
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRates.map((rate) => {
                const diff = pctDiff(rate);
                const active = isActiveNow(rate);
                return (
                  <div
                    key={rate.id}
                    className="bg-card rounded-2xl p-4 md:p-5 shadow-soft border border-border/60 hover:shadow-card transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display text-lg font-semibold text-foreground">
                            {rate.property?.title || "Imóvel removido"}
                          </h3>
                          {rate.label && (
                            <Badge variant="outline" className="uppercase tracking-wider text-[10px] font-bold text-primary border-primary/30">
                              {rate.label}
                            </Badge>
                          )}
                          {active && (
                            <Badge className="bg-green-500/95 text-white hover:bg-green-600 uppercase tracking-wider text-[10px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-pulse" />
                              Ativa agora
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                          <span>
                            {fmtDate(rate.start_date)} — {fmtDate(rate.end_date)}
                          </span>
                          <span className="text-foreground font-medium">
                            ({nights(rate)} {nights(rate) === 1 ? "diária" : "diárias"})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-4">
                        <div className="text-left md:text-right">
                          {rate.property && (
                            <p className="text-xs text-muted-foreground">
                              Padrão {fmtMoney(rate.property.price_per_night)}
                            </p>
                          )}
                          <div className="flex items-center gap-2 md:justify-end">
                            <p className="text-xl md:text-2xl font-bold tracking-tight text-primary">
                              {fmtMoney(rate.daily_price)}
                            </p>
                            {diff !== null && diff !== 0 && (
                              <span className={cn(
                                "inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                                diff > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                              )}>
                                <TrendingUp className={cn("w-3 h-3", diff < 0 && "rotate-180")} />
                                {diff > 0 ? "+" : ""}{diff}%
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => handleOpenDialog(rate)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                            onClick={() => handleDelete(rate)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminAltaTemporada;
