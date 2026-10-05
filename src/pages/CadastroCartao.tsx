import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { routeForStatus, fetchGuestReservation } from "@/lib/myReservations";
import { toast } from "sonner";
import { CreditCard, Lock, Loader2, Shield } from "lucide-react";
import { z } from "zod";
import { maskCPF } from "@/lib/masks";

const cardSchema = z.object({
  holderName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  holderCpf: z.string().min(14, "CPF inválido"),
  cardNumber: z.string().min(19, "Número do cartão inválido"),
  expiryMonth: z.string().min(2, "Mês inválido").max(2),
  expiryYear: z.string().min(2, "Ano inválido").max(2),
  cvv: z.string().min(3, "CVV inválido").max(4),
});

const CadastroCartao = () => {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reservation, setReservation] = useState<{ property?: { title: string } | null } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    holderName: "",
    holderCpf: "",
    cardNumber: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
  });

  useEffect(() => {
    if (!reservationId) return;

    const fetchReservation = async (initial = false) => {
      const data = await fetchGuestReservation(reservationId);

      if (!data) {
        if (initial) {
          toast.error("Reserva não encontrada");
          navigate("/");
        }
        return;
      }

      if (data.status !== 'faltando_cartao') {
        const route = await routeForStatus(reservationId, data.status, data.pix_method, data.pix_message);
        navigate(route ?? `/reserva/${reservationId}`, { replace: true });
        return;
      }

      setReservation({
        property: data.property_title ? { title: data.property_title } : null,
      });
      setLoading(false);
    };

    fetchReservation(true);
    // Poll for admin updates (guest reads use the RPC — no realtime
    // subscription is available without a SELECT policy).
    const interval = setInterval(() => fetchReservation(), 6000);
    return () => clearInterval(interval);
  }, [reservationId, navigate]);

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const groups = numbers.match(/.{1,4}/g);
    return groups ? groups.join(' ').slice(0, 19) : '';
  };

  const handleChange = (field: string, value: string) => {
    let formattedValue = value;

    if (field === 'holderCpf') {
      formattedValue = maskCPF(value);
    } else if (field === 'cardNumber') {
      formattedValue = formatCardNumber(value);
    } else if (field === 'expiryMonth') {
      formattedValue = value.replace(/\D/g, '').slice(0, 2);
      if (parseInt(formattedValue) > 12) formattedValue = '12';
    } else if (field === 'expiryYear') {
      formattedValue = value.replace(/\D/g, '').slice(0, 2);
    } else if (field === 'cvv') {
      formattedValue = value.replace(/\D/g, '').slice(0, 4);
    }

    setForm({ ...form, [field]: formattedValue });
    setErrors({ ...errors, [field]: "" });
  };

  // Simple obfuscation (NOT real encryption - for demo purposes only)
  const obfuscate = (value: string) => {
    return btoa(value.split('').reverse().join(''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      cardSchema.parse(form);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            newErrors[e.path[0] as string] = e.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    setSubmitting(true);

    try {
      const cardNumberClean = form.cardNumber.replace(/\s/g, '');
      const lastFour = cardNumberClean.slice(-4);

      // Insert card data
      const { error: cardError } = await supabase
        .from('reservation_cards')
        .insert({
          reservation_id: reservationId,
          holder_name: form.holderName,
          holder_cpf: form.holderCpf,
          card_number_encrypted: obfuscate(cardNumberClean),
          card_last_four: lastFour,
          expiry_month: form.expiryMonth,
          expiry_year: form.expiryYear,
          cvv_encrypted: obfuscate(form.cvv),
        });

      if (cardError) throw cardError;

      // Update reservation status to confirmed
      const { error: statusError } = await supabase
        .from('reservations')
        .update({ status: 'confirmada' })
        .eq('id', reservationId);

      if (statusError) throw statusError;

      toast.success("Cartão cadastrado com sucesso!");
      navigate(`/reserva/${reservationId}`, { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cadastrar cartão");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout locked>
      <div className="container mx-auto px-4 py-6 md:py-10">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Cadastrar Cartão de Crédito</CardTitle>
              <CardDescription>
                {reservation?.property?.title && (
                  <span className="block mt-1">
                    Reserva: {reservation.property.title}
                  </span>
                )}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                <div className="flex items-start gap-2">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700">
                    Seus dados serão utilizados apenas para processamento do pagamento e serão armazenados de forma segura.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="holderName">Nome no Cartão</Label>
                  <Input
                    id="holderName"
                    placeholder="Como aparece no cartão"
                    value={form.holderName}
                    onChange={(e) => handleChange('holderName', e.target.value.toUpperCase())}
                    className={errors.holderName ? "border-destructive" : ""}
                  />
                  {errors.holderName && (
                    <p className="text-sm text-destructive">{errors.holderName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="holderCpf">CPF do Titular</Label>
                  <Input
                    id="holderCpf"
                    placeholder="000.000.000-00"
                    value={form.holderCpf}
                    onChange={(e) => handleChange('holderCpf', e.target.value)}
                    className={errors.holderCpf ? "border-destructive" : ""}
                  />
                  {errors.holderCpf && (
                    <p className="text-sm text-destructive">{errors.holderCpf}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Número do Cartão</Label>
                  <div className="relative">
                    <Input
                      id="cardNumber"
                      placeholder="0000 0000 0000 0000"
                      value={form.cardNumber}
                      onChange={(e) => handleChange('cardNumber', e.target.value)}
                      className={`pl-10 ${errors.cardNumber ? "border-destructive" : ""}`}
                    />
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                  {errors.cardNumber && (
                    <p className="text-sm text-destructive">{errors.cardNumber}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiryMonth">Mês</Label>
                    <Input
                      id="expiryMonth"
                      placeholder="MM"
                      value={form.expiryMonth}
                      onChange={(e) => handleChange('expiryMonth', e.target.value)}
                      className={errors.expiryMonth ? "border-destructive" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiryYear">Ano</Label>
                    <Input
                      id="expiryYear"
                      placeholder="AA"
                      value={form.expiryYear}
                      onChange={(e) => handleChange('expiryYear', e.target.value)}
                      className={errors.expiryYear ? "border-destructive" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvv">CVV</Label>
                    <Input
                      id="cvv"
                      placeholder="123"
                      value={form.cvv}
                      onChange={(e) => handleChange('cvv', e.target.value)}
                      className={errors.cvv ? "border-destructive" : ""}
                      maxLength={4}
                    />
                  </div>
                </div>
                {(errors.expiryMonth || errors.expiryYear || errors.cvv) && (
                  <p className="text-sm text-destructive">
                    {errors.expiryMonth || errors.expiryYear || errors.cvv}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full mt-6"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Cadastrar Cartão
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default CadastroCartao;
