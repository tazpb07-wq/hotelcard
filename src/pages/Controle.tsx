import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { fetchGuestReservation } from "@/lib/myReservations";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils";

import {
  ArrowLeft,
  Key,
  Tv,
  Thermometer,
  Droplets,
  Lightbulb,
  Volume2,
  Loader2,
  Wind,
  Snowflake,
  Sun,
  Copy,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Zap,
  Leaf,
  BedDouble,
  Bath,
  ChefHat,
  Check,
  Edit3,
} from "lucide-react";

interface ReservationControl {
  id: string;
  reservation_id: string;
  door_access_code: string;
  tv_on: boolean;
  tv_channel: number;
  tv_volume: number;
  ac_on: boolean;
  ac_temperature: number;
  ac_mode: string;
  ac_turbo_mode: boolean;
  ac_eco_mode: boolean;
  hot_water_on: boolean;
  hot_water_temperature: number;
  water_temp_mode: string;
  lights_on: boolean;
  lights_intensity: number;
  lights_bedroom_on: boolean;
  lights_bedroom_intensity: number;
  lights_bathroom_on: boolean;
  lights_bathroom_intensity: number;
  lights_kitchen_on: boolean;
  lights_kitchen_intensity: number;
}

interface Reservation {
  id: string;
  status: string;
  check_in: string;
  check_out: string;
  property: {
    title: string;
  } | null;
}

const Controle = () => {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [controls, setControls] = useState<ReservationControl | null>(null);
  const [editingAccessCode, setEditingAccessCode] = useState(false);
  const [newAccessCode, setNewAccessCode] = useState("");
  const [accessCodeChanged, setAccessCodeChanged] = useState(false);

  useEffect(() => {
    if (!reservationId) return;

    const fetchData = async () => {
      try {
        const resData = await fetchGuestReservation(reservationId);

        if (!resData) {
          toast.error("Reserva não encontrada");
          navigate("/");
          return;
        }

        if (resData.status !== "confirmada") {
          toast.error("Controles disponíveis apenas para reservas confirmadas");
          navigate("/");
          return;
        }

        setReservation({
          id: resData.id,
          status: resData.status,
          check_in: resData.check_in,
          check_out: resData.check_out,
          property: resData.property_title ? { title: resData.property_title } : null,
        });

        const { data: controlData, error: controlError } = await supabase
          .rpc("get_guest_controls", { p_reservation_id: reservationId });

        if (controlError) {
          console.error("Error fetching controls:", controlError);
          toast.error("Erro ao carregar controles");
        } else if (controlData) {
          setControls(controlData as ReservationControl);
          if (controlData.door_access_code !== "0000") {
            setAccessCodeChanged(true);
          }
        }
      } catch (err) {
        console.error("Error:", err);
        toast.error("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [reservationId, navigate]);

  const persistControls = async (updates: Record<string, unknown>) => {
    if (!controls || !reservationId) return;

    const previous = controls;
    setControls({ ...controls, ...updates } as ReservationControl);
    setSaving(true);
    try {
      const { error } = await supabase.rpc("update_guest_controls", {
        p_reservation_id: reservationId,
        p_patch: updates as Json,
      });

      if (error) throw error;
    } catch (err) {
      console.error("Error updating controls:", err);
      toast.error("Erro ao atualizar controles");
      setControls(previous);
    } finally {
      setSaving(false);
    }
  };

  const updateControl = (field: string, value: unknown) =>
    persistControls({ [field]: value });

  const updateMultipleControls = (updates: Record<string, unknown>) =>
    persistControls(updates);

  const handleChangeAccessCode = async () => {
    if (newAccessCode.length !== 4 || !/^\d{4}$/.test(newAccessCode)) {
      toast.error("A chave deve ter exatamente 4 números");
      return;
    }

    await updateControl("door_access_code", newAccessCode);
    setAccessCodeChanged(true);
    setEditingAccessCode(false);
    toast.success(`Chave alterada para ${newAccessCode}!`);
  };

  const copyAccessCode = () => {
    if (controls?.door_access_code) {
      navigator.clipboard.writeText(controls.door_access_code);
      toast.success("Código copiado!");
    }
  };

  const handleTurboMode = () => {
    updateMultipleControls({
      ac_turbo_mode: !controls?.ac_turbo_mode,
      ac_eco_mode: false,
    });
  };

  const handleEcoMode = () => {
    updateMultipleControls({
      ac_eco_mode: !controls?.ac_eco_mode,
      ac_turbo_mode: false,
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando controles...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!reservation || !controls) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Controles não disponíveis</p>
            <Button onClick={() => navigate("/")}>Voltar</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-secondary flex-1 py-6 md:py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Controle do Imóvel
              </h1>
              <p className="text-muted-foreground">
                {reservation.property?.title}
              </p>
            </div>
            {saving && (
              <Badge variant="outline" className="ml-auto">
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                Salvando...
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {/* Door Access */}
            <Card className="md:col-span-2 xl:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  Chave de Acesso
                </CardTitle>
                <CardDescription>
                  Código para abrir a porta do imóvel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!editingAccessCode ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-muted rounded-lg p-4 text-center">
                        <span className="text-3xl font-mono font-bold tracking-widest">
                          {controls.door_access_code || "0000"}
                        </span>
                      </div>
                      <Button variant="outline" size="icon" onClick={copyAccessCode}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {accessCodeChanged && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-700 text-sm">
                          <Check className="w-4 h-4" />
                          <span>Chave alterada. Agora use o código <strong>{controls.door_access_code}</strong> para acessar o imóvel.</span>
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setNewAccessCode("");
                        setEditingAccessCode(true);
                      }}
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Alterar Chave
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="newCode">Nova chave (4 números)</Label>
                      <Input
                        id="newCode"
                        type="text"
                        maxLength={4}
                        placeholder="0000"
                        value={newAccessCode}
                        onChange={(e) => setNewAccessCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="text-center text-2xl font-mono tracking-widest mt-2"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setEditingAccessCode(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleChangeAccessCode}
                        disabled={newAccessCode.length !== 4}
                      >
                        Confirmar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Validity Notice */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-amber-800">
                      <p className="font-medium mb-1">Validade da Chave</p>
                      <p>
                        A chave padrão (<strong>0000</strong>) é válida apenas no período da sua estadia,
                        entre o Check-in em <strong>{formatDateBR(reservation.check_in)}</strong> e
                        o Check-out em <strong>{formatDateBR(reservation.check_out)}</strong>.

                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* TV Control */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tv className="w-5 h-5 text-primary" />
                  Televisão
                </CardTitle>
                <CardDescription>
                  Controle da TV do imóvel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tv-switch" className="flex items-center gap-2">
                    Ligar TV
                  </Label>
                  <Switch
                    id="tv-switch"
                    checked={controls.tv_on}
                    onCheckedChange={(checked) => updateControl("tv_on", checked)}
                  />
                </div>

                {controls.tv_on && (
                  <>
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        Ajustar Volume: {controls.tv_volume}%
                      </Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateControl("tv_volume", Math.max(0, controls.tv_volume - 10))}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        <Slider
                          value={[controls.tv_volume]}
                          onValueChange={(value) => updateControl("tv_volume", value[0])}
                          max={100}
                          step={5}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateControl("tv_volume", Math.min(100, controls.tv_volume + 10))}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Mudar Canal: {controls.tv_channel}</Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => updateControl("tv_channel", Math.max(1, controls.tv_channel - 1))}
                        >
                          <ChevronDown className="w-4 h-4 mr-1" />
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => updateControl("tv_channel", controls.tv_channel + 1)}
                        >
                          Próximo
                          <ChevronUp className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* AC Control */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wind className="w-5 h-5 text-primary" />
                  Ar Condicionado
                </CardTitle>
                <CardDescription>
                  Controle de climatização (18°C - 25°C)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ac-switch">Ligar Ar</Label>
                  <Switch
                    id="ac-switch"
                    checked={controls.ac_on}
                    onCheckedChange={(checked) => updateControl("ac_on", checked)}
                  />
                </div>

                {controls.ac_on && (
                  <>
                    <div className="space-y-4">
                      <Label className="flex items-center gap-2 justify-center">
                        <Thermometer className="w-4 h-4" />
                        Ajustar Temperatura
                      </Label>
                      
                      {/* Temperature Display - Centered */}
                      <div className="flex justify-center">
                        <div className="bg-muted rounded-xl px-6 py-3">
                          <span className="text-3xl font-bold">{controls.ac_temperature}°C</span>
                        </div>
                      </div>
                      
                      {/* Slider */}
                      <Slider
                        value={[controls.ac_temperature]}
                        onValueChange={(value) => updateControl("ac_temperature", value[0])}
                        min={18}
                        max={25}
                        step={1}
                      />
                      
                      {/* Buttons - Equal Width */}
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => updateControl("ac_temperature", Math.max(18, controls.ac_temperature - 1))}
                        >
                          <Snowflake className="w-4 h-4 mr-2" />
                          Mais Frio
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => updateControl("ac_temperature", Math.min(25, controls.ac_temperature + 1))}
                        >
                          <Sun className="w-4 h-4 mr-2" />
                          Mais Quente
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Modos Especiais</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={controls.ac_turbo_mode ? "default" : "outline"}
                          size="sm"
                          onClick={handleTurboMode}
                          className={controls.ac_turbo_mode ? "bg-orange-500 hover:bg-orange-600" : ""}
                        >
                          <Zap className="w-4 h-4 mr-1" />
                          Modo Turbo
                        </Button>
                        <Button
                          variant={controls.ac_eco_mode ? "default" : "outline"}
                          size="sm"
                          onClick={handleEcoMode}
                          className={controls.ac_eco_mode ? "bg-green-500 hover:bg-green-600" : ""}
                        >
                          <Leaf className="w-4 h-4 mr-1" />
                          Modo Econômico
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Hot Water */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-primary" />
                  Água Quente
                </CardTitle>
                <CardDescription>
                  Controle do aquecedor de água
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="water-switch">Ligar Água Quente</Label>
                  <Switch
                    id="water-switch"
                    checked={controls.hot_water_on}
                    onCheckedChange={(checked) => updateControl("hot_water_on", checked)}
                  />
                </div>

                {controls.hot_water_on && (
                  <div className="space-y-3">
                    <Label>Ajustar Temperatura</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "gelada", label: "Gelada", icon: Snowflake, color: "text-blue-500" },
                        { value: "fria", label: "Fria", icon: Droplets, color: "text-cyan-500" },
                        { value: "morna", label: "Morna", icon: Droplets, color: "text-yellow-500" },
                        { value: "normal", label: "Normal", icon: Sun, color: "text-orange-500" },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          variant={controls.water_temp_mode === option.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateControl("water_temp_mode", option.value)}
                          className="justify-start"
                        >
                          <option.icon className={`w-4 h-4 mr-2 ${controls.water_temp_mode !== option.value ? option.color : ""}`} />
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lights - Bedroom */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BedDouble className="w-5 h-5 text-primary" />
                  Iluminação - Quarto
                </CardTitle>
                <CardDescription>
                  Controle das luzes do quarto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="lights-bedroom-switch">Ligar Luzes</Label>
                  <Switch
                    id="lights-bedroom-switch"
                    checked={controls.lights_bedroom_on}
                    onCheckedChange={(checked) => updateControl("lights_bedroom_on", checked)}
                  />
                </div>

                {controls.lights_bedroom_on && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Ajustar Intensidade: {controls.lights_bedroom_intensity}%
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateControl("lights_bedroom_intensity", Math.max(10, controls.lights_bedroom_intensity - 10))}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Slider
                        value={[controls.lights_bedroom_intensity]}
                        onValueChange={(value) => updateControl("lights_bedroom_intensity", value[0])}
                        min={10}
                        max={100}
                        step={10}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateControl("lights_bedroom_intensity", Math.min(100, controls.lights_bedroom_intensity + 10))}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lights - Bathroom */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bath className="w-5 h-5 text-primary" />
                  Iluminação - Banheiro
                </CardTitle>
                <CardDescription>
                  Controle das luzes do banheiro
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="lights-bathroom-switch">Ligar Luzes</Label>
                  <Switch
                    id="lights-bathroom-switch"
                    checked={controls.lights_bathroom_on}
                    onCheckedChange={(checked) => updateControl("lights_bathroom_on", checked)}
                  />
                </div>

                {controls.lights_bathroom_on && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Ajustar Intensidade: {controls.lights_bathroom_intensity}%
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateControl("lights_bathroom_intensity", Math.max(10, controls.lights_bathroom_intensity - 10))}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Slider
                        value={[controls.lights_bathroom_intensity]}
                        onValueChange={(value) => updateControl("lights_bathroom_intensity", value[0])}
                        min={10}
                        max={100}
                        step={10}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateControl("lights_bathroom_intensity", Math.min(100, controls.lights_bathroom_intensity + 10))}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lights - Kitchen */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-primary" />
                  Iluminação - Cozinha
                </CardTitle>
                <CardDescription>
                  Controle das luzes da cozinha
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="lights-kitchen-switch">Ligar Luzes</Label>
                  <Switch
                    id="lights-kitchen-switch"
                    checked={controls.lights_kitchen_on}
                    onCheckedChange={(checked) => updateControl("lights_kitchen_on", checked)}
                  />
                </div>

                {controls.lights_kitchen_on && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Ajustar Intensidade: {controls.lights_kitchen_intensity}%
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateControl("lights_kitchen_intensity", Math.max(10, controls.lights_kitchen_intensity - 10))}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Slider
                        value={[controls.lights_kitchen_intensity]}
                        onValueChange={(value) => updateControl("lights_kitchen_intensity", value[0])}
                        min={10}
                        max={100}
                        step={10}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateControl("lights_kitchen_intensity", Math.min(100, controls.lights_kitchen_intensity + 10))}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Os controles são salvos automaticamente. As alterações podem levar alguns segundos para serem aplicadas no imóvel.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Controle;
