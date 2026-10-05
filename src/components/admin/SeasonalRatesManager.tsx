import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Calendar, Loader2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSeasonalRatesAdmin, SeasonalRate, SeasonalRateInput } from "@/hooks/useSeasonalRates";

interface SeasonalRatesManagerProps {
  propertyId: string;
  propertyTitle: string;
}

export function SeasonalRatesManager({ propertyId, propertyTitle }: SeasonalRatesManagerProps) {
  const { rates, isLoading, createRate, updateRate, deleteRate } = useSeasonalRatesAdmin(propertyId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<SeasonalRate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
    daily_price: 0,
  });

  const resetForm = () => {
    setFormData({
      start_date: "",
      end_date: "",
      daily_price: 0,
    });
    setEditingRate(null);
  };

  const handleOpenDialog = (rate?: SeasonalRate) => {
    if (rate) {
      setEditingRate(rate);
      setFormData({
        start_date: rate.start_date,
        end_date: rate.end_date,
        daily_price: Number(rate.daily_price),
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const validateDates = (): boolean => {
    if (!formData.start_date || !formData.end_date) {
      toast.error("Selecione as datas de início e fim");
      return false;
    }

    if (formData.end_date < formData.start_date) {
      toast.error("A data de fim deve ser igual ou posterior à data de início");
      return false;
    }

    if (formData.daily_price <= 0) {
      toast.error("O valor da diária deve ser maior que zero");
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateDates()) return;

    setIsSaving(true);
    try {
      const rateData: SeasonalRateInput = {
        property_id: propertyId,
        start_date: formData.start_date,
        end_date: formData.end_date,
        daily_price: formData.daily_price,
      };

      if (editingRate) {
        await updateRate.mutateAsync({ id: editingRate.id, ...rateData });
        toast.success("Tarifa atualizada com sucesso!");
      } else {
        await createRate.mutateAsync(rateData);
        toast.success("Tarifa salva com sucesso!");
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

  const handleDelete = async (rate: SeasonalRate) => {
    if (!confirm(`Excluir tarifa do período ${formatDate(rate.start_date)} - ${formatDate(rate.end_date)}?`)) return;

    try {
      await deleteRate.mutateAsync(rate.id);
      toast.success("Tarifa removida com sucesso!");
    } catch (error) {
      console.error("Error deleting rate:", error);
      toast.error("Erro ao remover tarifa");
    }
  };

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Tarifas por Período
          </h3>
          <p className="text-sm text-muted-foreground">
            {propertyTitle}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button variant="gold" size="sm" onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Tarifa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRate ? "Editar Tarifa" : "Nova Tarifa Especial"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
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

              <div className="space-y-2">
                <Label htmlFor="daily_price">Valor da Diária (R$)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="daily_price"
                    type="number"
                    min="0"
                    step="0.01"
                    className="pl-9"
                    value={formData.daily_price}
                    onChange={(e) => setFormData((prev) => ({ ...prev, daily_price: Number(e.target.value) }))}
                  />
                </div>
              </div>

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
      </div>

      {rates.length === 0 ? (
        <div className="bg-muted/50 rounded-lg p-6 text-center">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            Nenhuma tarifa especial cadastrada
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione tarifas para datas específicas como feriados e alta temporada
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Diária</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="font-medium">
                    {formatDate(rate.start_date)} - {formatDate(rate.end_date)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    R$ {Number(rate.daily_price).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(rate)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(rate)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
