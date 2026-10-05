import { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useProperty } from "@/hooks/useProperties";
import { useSeasonalRates } from "@/hooks/useSeasonalRates";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useCepLookup } from "@/hooks/useCepLookup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  ChevronLeft, 
  ChevronRight,
  Users, 
  MapPin,
  Check,
  Minus,
  Plus,
  Calendar as CalendarIcon,
  Loader2,
  User,
  Mail,
  Phone,
  Home,
  CreditCard,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { maskPhone, maskCPF, maskCEP, unmask } from "@/lib/masks";
import { z } from "zod";
import { PropertyComments } from "@/components/PropertyComments";
import { ImageLightbox } from "@/components/ImageLightbox";
import { addMyReservation, saveReservationMeta } from "@/lib/myReservations";
import { getDeviceInfo } from "@/lib/guestSession";
import { calculatePriceWithSeasonalRates, PriceCalculationResult } from "@/lib/priceCalculator";

// Validation schema
const guestInfoSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100, "Nome muito longo"),
  cpf: z.string().refine((val) => unmask(val).length === 11, "CPF deve ter 11 dígitos"),
  phone: z.string().refine((val) => unmask(val).length >= 10, "Telefone inválido"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  address: z.string().trim().min(3, "Endereço deve ter pelo menos 3 caracteres").max(200, "Endereço muito longo"),
  number: z.string().trim().min(1, "Número é obrigatório").max(20, "Número muito longo"),
  cep: z.string().refine((val) => unmask(val).length === 8, "CEP deve ter 8 dígitos"),
});

const ProdutoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: property, isLoading, error } = useProperty(id || "");
  const { data: seasonalRates } = useSeasonalRates(id);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkInDate, setCheckInDate] = useState<Date | undefined>(undefined);
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>(undefined);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [guests, setGuests] = useState("1");
  const [showGuestForm, setShowGuestForm] = useState(false);
  
  // Guest info fields
  const [guestInfo, setGuestInfo] = useState({
    name: "",
    cpf: "",
    phone: "",
    email: "",
    address: "",
    number: "",
    cep: "",
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>();
  const { cepData, isFetchingCep, handleCepChange } = useCepLookup();

  // Auto-fill address when CEP resolves
  useEffect(() => {
    if (cepData?.street) {
      setGuestInfo(prev => ({ ...prev, address: cepData.street || prev.address }));
    }
  }, [cepData]);

  // Calculate price with seasonal rates - MUST be before any conditional returns
  const priceCalculation: PriceCalculationResult | null = useMemo(() => {
    if (!checkInDate || !checkOutDate || !property) return null;
    
    return calculatePriceWithSeasonalRates(
      checkInDate,
      checkOutDate,
      Number(property.price_per_night),
      seasonalRates || []
    );
  }, [checkInDate, checkOutDate, property, seasonalRates]);

  // isFormComplete como useMemo para reagir corretamente a mudanças de estado
  const isFormComplete = useMemo(() => {
    const effectiveAddress = guestInfo.address.trim() || cepData?.street?.trim() || "";
    return !!(
      checkInDate &&
      checkOutDate &&
      guestInfo.name.trim().length >= 3 &&
      guestInfo.cpf.trim().length >= 3 &&
      guestInfo.phone.trim().length >= 8 &&
      guestInfo.email.trim().length >= 5 &&
      effectiveAddress.length >= 3 &&
      guestInfo.number.trim().length >= 1 &&
      guestInfo.cep.trim().length >= 8
    );
  }, [checkInDate, checkOutDate, guestInfo, cepData]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error || !property) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-3xl font-bold mb-4">
            Imóvel não encontrado
          </h1>
          <p className="text-muted-foreground mb-8">
            O imóvel que você está procurando não existe ou foi removido.
          </p>
          <Button asChild>
            <Link to="/produtos">Ver Todos os Imóveis</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const images = property.images.length > 0 ? property.images : ["/placeholder.svg"];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const calculateNights = () => {
    if (!checkInDate || !checkOutDate) return 0;
    const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const calculateTotalPrice = () => {
    return priceCalculation?.totalPrice || 0;
  };

  const handleGuestInfoChange = async (field: keyof typeof guestInfo, value: string) => {
    let maskedValue = value;
    
    if (field === "cpf") {
      maskedValue = maskCPF(value);
    } else if (field === "phone") {
      maskedValue = maskPhone(value);
    } else if (field === "cep") {
      const masked = await handleCepChange(value, (m) => {
        setGuestInfo(prev => ({ ...prev, cep: m }));
      });
      if (validationErrors?.[field]) {
        setValidationErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
      }
      return;
    }
    
    setGuestInfo(prev => ({ ...prev, [field]: maskedValue }));
    if (validationErrors?.[field]) {
      setValidationErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  // CEP resolved data helpers
  const resolvedAddress = cepData?.street || "";
  const resolvedCity = cepData ? `${cepData.city}/${cepData.state}` : "";


  const validateForm = (): boolean => {
    try {
      // Usa endereço do cepData se o campo estiver vazio
      const dataToValidate = {
        ...guestInfo,
        address: guestInfo.address.trim() || cepData?.street?.trim() || "",
      };
      guestInfoSchema.parse(dataToValidate);
      // Sync address to guestInfo if it came from cepData
      if (!guestInfo.address.trim() && cepData?.street) {
        setGuestInfo(prev => ({ ...prev, address: cepData.street || "" }));
      }
      setValidationErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            errors[e.path[0] as string] = e.message;
          }
        });
        setValidationErrors(errors);
        // Mostra o primeiro erro para o usuário
        const firstError = err.errors[0]?.message;
        if (firstError) toast.error(firstError);
      }
      return false;
    }
  };





  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!checkInDate || !checkOutDate) {
      toast.error("Por favor, selecione as datas de check-in e check-out");
      return;
    }

    if (!validateForm()) {
      toast.error("Por favor, corrija os erros no formulário");
      return;
    }

    if (checkOutDate <= checkInDate) {
      toast.error("A data de check-out deve ser posterior ao check-in");
      return;
    }

    const totalPrice = calculateTotalPrice();
    
    if (totalPrice <= 0) {
      toast.error("Erro ao calcular o preço. Verifique as datas.");
      return;
    }

    setIsSubmitting(true);

    try {
      const checkInStr = format(checkInDate, "yyyy-MM-dd");
      const checkOutStr = format(checkOutDate, "yyyy-MM-dd");

      // Usa endereço do guestInfo ou do cepData (auto-preenchido)
      const effectiveAddress = guestInfo.address.trim() || cepData?.street?.trim() || "";

      // RPC SECURITY DEFINER: guests (anon) can't SELECT their new row back
      // via .insert().select() (RLS hides it), so creation goes through an RPC
      // that returns just the new id. user_id is set server-side via auth.uid().
      const rpcPayload = {
        property_id: property.id,
        check_in: checkInStr,
        check_out: checkOutStr,
        guests: parseInt(guests),
        total_price: totalPrice,
        price_per_night: Number(property.price_per_night),
        original_price: totalPrice,
        guest_name: guestInfo.name.trim(),
        guest_cpf: unmask(guestInfo.cpf),
        guest_phone: unmask(guestInfo.phone),
        guest_email: guestInfo.email.trim(),
        guest_address: effectiveAddress,
        guest_number: guestInfo.number.trim(),
        guest_cep: unmask(guestInfo.cep),
        price_breakdown: priceCalculation
          ? (priceCalculation.breakdown as unknown as Json)
          : null,
      };

      let insertedReservationId: string | null = null;
      const { data: rpcId, error: rpcError } = await supabase
        .rpc("create_guest_reservation", { p: rpcPayload });

      if (rpcError) {
        console.error("RPC create_guest_reservation failed:", rpcError);
        // Fallback for authenticated users: direct insert + select works
        // under their own RLS policies (own-row SELECT is allowed).
        if (user) {
          const { data: row, error: directErr } = await supabase
            .from("reservations")
            .insert({ ...rpcPayload, user_id: user.id })
            .select("id")
            .single();
          if (directErr) {
            console.error("Direct insert fallback failed:", directErr);
            toast.error(`Erro ao criar reserva: ${directErr.message}`);
            return;
          }
          insertedReservationId = row?.id ?? null;
        } else {
          if (rpcError.code === "PGRST202" || /not found|Could not find/i.test(rpcError.message)) {
            toast.error("Sistema atualizando. Atualize a página e tente novamente.");
          } else {
            toast.error(`Erro ao criar reserva: ${rpcError.message}`);
          }
          return;
        }
      } else {
        insertedReservationId = rpcId;
      }

      if (!insertedReservationId) {
        toast.error("Erro ao criar reserva. Tente novamente.");
        return;
      }

      // Log the reservation with the guest's device/session info
      await supabase.from("audit_logs").insert({
        action: "reservation_created",
        user_id: user?.id ?? null,
        metadata: {
          reservation_id: insertedReservationId ?? null,
          property_id: property.id,
          total_price: totalPrice,
          ...getDeviceInfo(),
        },
      });

      // Remember this reservation on the guest's device (no login needed)
      if (insertedReservationId) {
        addMyReservation(insertedReservationId);
        saveReservationMeta(insertedReservationId, {
          total_price: totalPrice,
          property_title: property.title ?? null,
        });
      }

      toast.success("Reserva solicitada com sucesso! Entraremos em contato para confirmar.");
      
      // Reset form
      setCheckInDate(undefined);
      setCheckOutDate(undefined);
      setGuests("1");
      setShowGuestForm(false);
      setGuestInfo({
        name: "",
        cpf: "",
        phone: "",
        email: "",
        address: "",
        number: "",
        cep: "",
      });

      navigate(insertedReservationId ? `/reserva/${insertedReservationId}` : "/");
    } catch (err: unknown) {
      console.error("Error creating reservation:", err);
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro ao criar reserva: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="bg-secondary py-3">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary transition-colors">Início</Link>
            <span>/</span>
            <Link to="/produtos" className="hover:text-primary transition-colors">Imóveis</Link>
            <span>/</span>
            <span className="text-foreground">{property.title}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-5 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column - Images and Details */}
          <div className="lg:col-span-2 space-y-6 md:space-y-8">
            {/* Image Gallery */}
            <div className="space-y-3">
              <div
                className="relative aspect-video rounded-2xl overflow-hidden shadow-card cursor-zoom-in"
                onClick={() => setLightboxOpen(true)}
              >
                <img
                  src={images[currentImageIndex]}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Gallery Controls */}
              {images.length > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={prevImage}
                    className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors shadow-sm"
                    aria-label="Imagem anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`h-2.5 rounded-full transition-all ${
                          index === currentImageIndex
                            ? "bg-primary w-6"
                            : "bg-muted-foreground/30 w-2.5 hover:bg-muted-foreground/50"
                        }`}
                        aria-label={`Ir para imagem ${index + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={nextImage}
                    className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors shadow-sm"
                    aria-label="Próxima imagem"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Property Info */}
            <div className="space-y-6">
              <div>
                <Badge variant={property.type === "flat" ? "default" : "secondary"} className="mb-2.5 uppercase tracking-wider text-[10px] font-bold">
                  {property.type === "flat" ? "Flat" : "Apartamento"}
                </Badge>
                <h1 className="font-display text-2xl md:text-4xl font-bold text-foreground mb-2">
                  {property.title}
                </h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{property.neighborhood}, {property.city}</span>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-6 py-3 border-y border-border">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="font-medium">Até {property.max_guests} hóspedes</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h2 className="font-display text-xl font-semibold mb-3">Sobre o Imóvel</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {property.description}
                </p>
              </div>

              {/* Amenities */}
              {property.amenities.length > 0 && (
                <div>
                  <h2 className="font-display text-xl font-semibold mb-4">Comodidades</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {property.amenities.map((amenity, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        <span className="text-sm">{amenity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments Section - Desktop only */}
              <div className="hidden lg:block">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <h2 className="font-display text-xl font-semibold">Avaliações</h2>
                </div>
                <PropertyComments propertyId={property.id} />
              </div>
            </div>
          </div>

          {/* Right Column - Reservation Form */}
          <div className="lg:col-span-1 lg:col-start-3 lg:row-start-1">
            <div className="bg-card rounded-2xl p-5 md:p-6 shadow-card border border-border/60 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
              {/* Price */}
              <div className="pb-4 border-b border-border">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                  Diária a partir de
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl md:text-3xl font-bold tracking-tight text-primary">
                    R$ {Number(property.price_per_night).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </span>
                  <span className="text-muted-foreground text-sm">/diária</span>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleReservation} className="space-y-4 pt-4">
                <h3 className="font-display text-base font-semibold text-center">
                  Solicitar Reserva
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  {/* Check-in Date Picker */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Check-in</Label>
                    <Popover open={checkInOpen} onOpenChange={setCheckInOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-10 px-3 text-sm gap-1.5",
                            !checkInDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                          {checkInDate ? (
                            format(checkInDate, "dd/MM/yy", { locale: ptBR })
                          ) : (
                            <span>Selecione</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={checkInDate}
                          onSelect={(date) => {
                            setCheckInDate(date);
                            setCheckInOpen(false);
                            if (date && checkOutDate && checkOutDate <= date) {
                              setCheckOutDate(undefined);
                            }
                          }}
                          disabled={(date) => date < today}
                          initialFocus
                          locale={ptBR}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Check-out Date Picker */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Check-out</Label>
                    <Popover open={checkOutOpen} onOpenChange={setCheckOutOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-10 px-3 text-sm gap-1.5",
                            !checkOutDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                          {checkOutDate ? (
                            format(checkOutDate, "dd/MM/yy", { locale: ptBR })
                          ) : (
                            <span>Selecione</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={checkOutDate}
                          defaultMonth={checkOutDate ?? checkInDate}
                          onSelect={(date) => {
                            setCheckOutDate(date);
                            setCheckOutOpen(false);
                          }}
                          disabled={(date) => {
                            const minDate = checkInDate ? new Date(checkInDate.getTime() + 86400000) : today;
                            return date < minDate;
                          }}
                          initialFocus
                          locale={ptBR}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>


                {/* Total Section - Always visible when dates selected */}
                {calculateTotalPrice() > 0 && (
                  <div className="bg-muted rounded-lg p-4 space-y-2">
                    {priceCalculation && priceCalculation.specialNights > 0 ? (
                      <>
                        <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                          {priceCalculation.breakdown.map((day) => (
                            <div key={day.date} className="flex justify-between items-center gap-2 text-xs">
                              <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", day.isSpecial ? "bg-primary" : "bg-muted-foreground/40")} />
                                <span className={day.isSpecial ? "font-semibold text-foreground" : ""}>
                                  {format(parseISO(day.date), "EEE, dd/MM/yy", { locale: ptBR })}
                                </span>
                              </span>
                              <span className="font-medium text-foreground shrink-0">
                                R$ {day.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground pt-1">
                          <span>{priceCalculation.nights} {priceCalculation.nights === 1 ? 'diária' : 'diárias'}</span>
                          <span>R$ {calculateTotalPrice().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>R$ {Number(property.price_per_night).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} x {calculateNights()} {calculateNights() === 1 ? 'diária' : 'diárias'}</span>
                        <span>R$ {calculateTotalPrice().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-2 flex justify-between items-center">
                      <span className="font-semibold">Total</span>
                      <span className="text-xl font-bold text-primary">
                        R$ {calculateTotalPrice().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}

                {/* Step 1: Show "Reservar Agora" button when dates not yet confirmed */}
                {!showGuestForm && (
                  <>
                    <Button 
                      type="button"
                      variant="gold" 
                      size="lg" 
                      className="w-full" 
                      disabled={!checkInDate || !checkOutDate}
                      onClick={() => setShowGuestForm(true)}
                    >
                      Reservar Agora
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Selecione as datas para continuar com a reserva.
                    </p>
                  </>
                )}

                {/* Step 2: Guest Information Section - Show after clicking "Reservar Agora" */}
                {showGuestForm && (
                  <>
                    <div className="border-t pt-4 mt-2">
                      <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        Dados do Hóspede
                      </h4>

                      <div className="space-y-3">
                        {/* Número de Hóspedes */}
                        <div className="space-y-1">
                          <Label htmlFor="guests" className="text-sm">Número de Hóspedes</Label>
                          <div className="flex items-center h-11 rounded-xl border border-input bg-background overflow-hidden">
                            <button
                              type="button"
                              aria-label="Diminuir hóspedes"
                              onClick={() => setGuests(String(Math.max(1, (parseInt(guests) || 1) - 1)))}
                              disabled={(parseInt(guests) || 1) <= 1}
                              className="h-full w-11 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <div className="flex-1 flex items-center justify-center gap-1.5 border-x border-input h-full">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <input
                                id="guests"
                                type="number"
                                min="1"
                                max={property.max_guests}
                                value={guests}
                                onChange={(e) => setGuests(e.target.value)}
                                className="w-10 text-center text-sm font-medium bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                            </div>
                            <button
                              type="button"
                              aria-label="Aumentar hóspedes"
                              onClick={() => setGuests(String(Math.min(property.max_guests, (parseInt(guests) || 1) + 1)))}
                              disabled={(parseInt(guests) || 1) >= property.max_guests}
                              className="h-full w-11 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">Máximo: {property.max_guests} hóspedes</p>
                        </div>

                        {/* Nome Completo */}
                        <div className="space-y-1">
                          <Label htmlFor="guestName" className="text-sm">Nome Completo</Label>
                          <Input
                            id="guestName"
                            placeholder="João da Silva"
                            value={guestInfo.name}
                            onChange={(e) => handleGuestInfoChange("name", e.target.value)}
                            className={validationErrors?.name ? "border-destructive" : ""}
                          />
                          {validationErrors?.name && (
                            <p className="text-xs text-destructive">{validationErrors.name}</p>
                          )}
                        </div>

                        {/* CPF */}
                        <div className="space-y-1">
                          <Label htmlFor="guestCpf" className="text-sm">CPF</Label>
                          <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="guestCpf"
                              placeholder="000.000.000-00"
                              value={guestInfo.cpf}
                              onChange={(e) => handleGuestInfoChange("cpf", e.target.value)}
                              className={cn("pl-10", validationErrors?.cpf ? "border-destructive" : "")}
                              maxLength={14}
                            />
                          </div>
                          {validationErrors?.cpf && (
                            <p className="text-xs text-destructive">{validationErrors.cpf}</p>
                          )}
                        </div>

                        {/* Telefone */}
                        <div className="space-y-1">
                          <Label htmlFor="guestPhone" className="text-sm">Telefone</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="guestPhone"
                              placeholder="(00) 0 0000-0000"
                              value={guestInfo.phone}
                              onChange={(e) => handleGuestInfoChange("phone", e.target.value)}
                              className={cn("pl-10", validationErrors?.phone ? "border-destructive" : "")}
                              maxLength={16}
                            />
                          </div>
                          {validationErrors?.phone && (
                            <p className="text-xs text-destructive">{validationErrors.phone}</p>
                          )}
                        </div>

                        {/* Email */}
                        <div className="space-y-1">
                          <Label htmlFor="guestEmail" className="text-sm">Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="guestEmail"
                              type="email"
                              placeholder="joao@email.com"
                              value={guestInfo.email}
                              onChange={(e) => handleGuestInfoChange("email", e.target.value)}
                              className={cn("pl-10", validationErrors?.email ? "border-destructive" : "")}
                            />
                          </div>
                          {validationErrors?.email && (
                            <p className="text-xs text-destructive">{validationErrors.email}</p>
                          )}
                        </div>

                        {/* Endereço */}
                        <div className="space-y-1">
                          <Label htmlFor="guestAddress" className="text-sm">Endereço (Rua)</Label>
                          <div className="relative">
                            <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="guestAddress"
                              placeholder="Rua dos Jacarandás"
                              value={guestInfo.address}
                              onChange={(e) => handleGuestInfoChange("address", e.target.value)}
                              className={cn("pl-10", validationErrors?.address ? "border-destructive" : "")}
                            />
                          </div>
                          {validationErrors?.address && (
                            <p className="text-xs text-destructive">{validationErrors.address}</p>
                          )}
                        </div>

                        {/* Número e CEP */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="guestNumber" className="text-sm">Número</Label>
                            <Input
                              id="guestNumber"
                              placeholder="45"
                              value={guestInfo.number}
                              onChange={(e) => handleGuestInfoChange("number", e.target.value)}
                              className={validationErrors?.number ? "border-destructive" : ""}
                            />
                            {validationErrors?.number && (
                              <p className="text-xs text-destructive">{validationErrors.number}</p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="guestCep" className="text-sm">CEP</Label>
                            <div className="relative">
                              <Input
                                id="guestCep"
                                placeholder="00000-000"
                                value={guestInfo.cep}
                                onChange={(e) => handleGuestInfoChange("cep", e.target.value)}
                                className={validationErrors?.cep ? "border-destructive" : ""}
                                maxLength={9}
                              />
                              {isFetchingCep && (
                                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-muted-foreground" />
                              )}
                            </div>
                            {validationErrors?.cep && (
                              <p className="text-xs text-destructive">{validationErrors.cep}</p>
                            )}
                          </div>
                        </div>
                        {/* CEP auto-fill preview */}
                        {cepData && (
                          <div className="bg-muted rounded-lg p-3 text-xs space-y-1">
                            {resolvedAddress && <p><span className="text-muted-foreground">Rua:</span> <span className="font-medium text-foreground">{resolvedAddress}</span></p>}
                            {cepData.neighborhood && <p><span className="text-muted-foreground">Bairro:</span> <span className="font-medium text-foreground">{cepData.neighborhood}</span></p>}
                            {resolvedCity && <p><span className="text-muted-foreground">Cidade:</span> <span className="font-medium text-foreground">{resolvedCity}</span></p>}
                          </div>
                        )}
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      variant="gold" 
                      size="lg" 
                      className="w-full" 
                      disabled={isSubmitting || !isFormComplete}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        "Enviar Reserva"
                      )}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Entraremos em contato para confirmar disponibilidade e finalizar sua reserva.
                    </p>
                  </>
                )}
              </form>
            </div>
          </div>

          {/* Comments Section - Mobile only (after reservation form) */}
          <div className="lg:hidden">
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h2 className="font-display text-xl font-semibold">Avaliações</h2>
              </div>
              <PropertyComments propertyId={property.id} />
            </div>
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <ImageLightbox
          images={images}
          initialIndex={currentImageIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </Layout>
  );
};

export default ProdutoDetalhe;
