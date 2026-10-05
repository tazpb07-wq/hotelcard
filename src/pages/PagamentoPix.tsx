import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { routeForStatus, fetchGuestReservation, saveGuestRoute } from "@/lib/myReservations";
import { useGuestRouteChannel } from "@/hooks/useGuestRouteChannel";
import { Copy, Check, QrCode, Smartphone, Loader2, Calendar, MapPin, Users, Mail, Phone, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateLocal, formatDateBR } from "@/lib/utils";


interface ReservationDetails {
  id: string;
  total_price: number;
  check_in: string;
  check_out: string;
  guests: number;
  status: string;
  payment_link: string | null;
  pix_message: string | null;
  pix_image_url: string | null;
  pix_method: 'email' | 'telefone' | 'copiar_colar' | null;
  pix_account_name: string | null;
  pix_bank_name: string | null;
  property: {
    title: string;
    neighborhood: string | null;
  };
}

const PagamentoPix = () => {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [reservation, setReservation] = useState<ReservationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  useGuestRouteChannel(reservationId);

  useEffect(() => {
    if (!reservationId) return;

    const fetchReservation = async (showError = false) => {
      const data = await fetchGuestReservation(reservationId);

      if (!data) {
        if (showError) {
          toast({
            title: "Erro",
            description: "Não foi possível carregar os dados da reserva.",
            variant: "destructive",
          });
        }
        setLoading(false);
        return;
      }

      // Follow wherever the admin pointed this reservation
      const route = await routeForStatus(data.id, data.status, data.pix_method, data.pix_message);
      saveGuestRoute(data.id, route);
      if (!route) {
        navigate(`/reserva/${reservationId}`, { replace: true });
        return;
      }
      if (!route.startsWith("/pagamento-pix")) {
        navigate(route, { replace: true });
        return;
      }

      setReservation({
        id: data.id,
        total_price: data.total_price,
        check_in: data.check_in,
        check_out: data.check_out,
        guests: data.guests,
        status: data.status,
        payment_link: data.payment_link,
        pix_message: data.pix_message,
        pix_image_url: data.pix_image_url,
        pix_method: (data.pix_method as 'email' | 'telefone' | 'copiar_colar') || 'copiar_colar',
        pix_account_name: data.pix_account_name,
        pix_bank_name: data.pix_bank_name,
        property: { title: data.property_title ?? "Imóvel", neighborhood: data.property_neighborhood },
      });
      setLoading(false);
    };

    fetchReservation(true);
    // Poll for admin updates (guest reads use the RPC — no realtime
    // subscription is available without a SELECT policy).
    const interval = setInterval(() => fetchReservation(), 6000);
    return () => clearInterval(interval);
  }, [reservationId, toast, navigate]);

  const handleCopyPix = async () => {
    if (!reservation?.payment_link) return;
    
    try {
      await navigator.clipboard.writeText(reservation.payment_link);
      setCopied(true);
      toast({
        title: "Copiado!",
        description: reservation.pix_method === 'email' 
          ? "O e-mail foi copiado para a área de transferência."
          : reservation.pix_method === 'telefone'
          ? "O número foi copiado para a área de transferência."
          : "A chave Pix foi copiada para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar. Tente selecionar manualmente.",
        variant: "destructive",
      });
    }
  };

  const handleWhatsAppSend = () => {
    const whatsappNumber = "5583987344520";
    const pixAmount = reservation?.pix_message && !isNaN(parseFloat(reservation.pix_message))
      ? parseFloat(reservation.pix_message)
      : reservation?.total_price ?? 0;
    const message = encodeURIComponent(
      `Olá! Aqui está meu comprovante de pagamento.\n\n` +
      `📍 Reserva: ${reservation?.property.title}\n` +
      `📅 Check-in: ${reservation ? formatDateBR(reservation.check_in) : ''}\n` +
      `📅 Check-out: ${reservation ? formatDateBR(reservation.check_out) : ''}\n` +
      `💰 Valor: R$ ${pixAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  };

  const calculateNights = (checkIn: string, checkOut: string) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const getMethodLabel = () => {
    switch (reservation?.pix_method) {
      case 'email':
        return 'E-mail';
      case 'telefone':
        return 'Número de Telefone';
      default:
        return 'Chave Pix';
    }
  };

  const getMethodIcon = () => {
    switch (reservation?.pix_method) {
      case 'email':
        return <Mail className="h-5 w-5" />;
      case 'telefone':
        return <Phone className="h-5 w-5" />;
      default:
        return <Copy className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!reservation) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-lg mx-auto">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">Reserva não encontrada.</p>
              <Button onClick={() => navigate("/")} className="mt-4">
                Voltar para o Início
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!reservation.payment_link) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-lg mx-auto">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">
                Dados de pagamento não configurados para esta reserva. Entre em contato com o suporte.
              </p>
              <Button onClick={() => navigate("/")} className="mt-4">
                Voltar para o Início
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const nights = calculateNights(reservation.check_in, reservation.check_out);
  const isCopiarColar = reservation.pix_method === 'copiar_colar';
  // Para copiar_colar: mostra imagem se existir, senão mostra QR Code
  // Para email/telefone: sempre mostra imagem se existir
  const showQRCode = isCopiarColar && !reservation.pix_image_url;
  const showUploadedImage = reservation.pix_image_url;
  const showImage = (reservation.pix_method === 'email' || reservation.pix_method === 'telefone') && reservation.pix_image_url;

  return (
    <Layout locked>
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Custom Image Banner - Only show for email/telefone methods */}
          {showImage && (
            <div className="rounded-xl overflow-hidden shadow-lg">
              <img 
                src={reservation.pix_image_url!} 
                alt="Banner de pagamento"
                className="w-full h-auto max-h-48 object-cover"
              />
            </div>
          )}

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
              <QrCode className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Realize seu pagamento via Pix
            </h1>
            <p className="text-muted-foreground">
              {showQRCode 
                ? "Escolha uma das opções abaixo para pagar sua reserva"
                : "Use as informações abaixo para realizar o pagamento"}
            </p>
          </div>

          {/* Fixed Message */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-center text-foreground">
                Após o pagamento, envie o comprovante via WhatsApp para confirmarmos sua reserva. Caso tenha alguma dúvida, entre em contato com a nossa equipe.
              </p>
            </CardContent>
          </Card>

          {/* Reservation Summary */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                {reservation.property.title}
              </CardTitle>
              {reservation.property.neighborhood && (
                <CardDescription>{reservation.property.neighborhood}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>
                  {format(parseDateLocal(reservation.check_in), "dd 'de' MMMM", { locale: ptBR })} - {format(parseDateLocal(reservation.check_out), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span>{reservation.guests} hóspede(s) • {nights} diária(s)</span>
              </div>
              <div className="pt-3 border-t space-y-1">
                {reservation.pix_message && !isNaN(parseFloat(reservation.pix_message)) && parseFloat(reservation.pix_message) !== reservation.total_price && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Total da reserva:</span>
                    <span>R$ {reservation.total_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {reservation.pix_message && !isNaN(parseFloat(reservation.pix_message)) && parseFloat(reservation.pix_message) !== reservation.total_price
                      ? `Valor a pagar (${Math.round((parseFloat(reservation.pix_message) / reservation.total_price) * 100)}%)`
                      : "Total a pagar"}
                  </span>
                  <span className="text-xl font-bold text-primary whitespace-nowrap">
                    R$ {(reservation.pix_message && !isNaN(parseFloat(reservation.pix_message))
                      ? parseFloat(reservation.pix_message)
                      : reservation.total_price
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QR Code Section - Only show for copiar_colar method when no uploaded image */}
          {isCopiarColar && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Escaneie o QR Code
                </CardTitle>
                <CardDescription>
                  Abra o app do seu banco e escaneie o código abaixo
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                {showUploadedImage ? (
                  // Show uploaded image instead of auto-generated QR Code
                  <div className="p-4 bg-white border shadow-inner">
                    <img 
                      src={reservation.pix_image_url!} 
                      alt="QR Code de pagamento"
                      className="w-[200px] h-[200px] object-contain"
                    />
                  </div>
                ) : (
                  // Show auto-generated QR Code
                  <div className="p-4 bg-white rounded-xl shadow-inner border">
                    <QRCodeSVG
                      value={reservation.payment_link}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                )}
                <p className="text-sm text-muted-foreground text-center">
                  Aponte a câmera do seu celular para o QR Code acima
                </p>
              </CardContent>
            </Card>
          )}

          {/* Copy Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getMethodIcon()}
                {showQRCode ? "Ou copie a chave Pix" : getMethodLabel()}
              </CardTitle>
              <CardDescription>
                {reservation.pix_method === 'email'
                  ? "Copie o e-mail abaixo para enviar o comprovante de pagamento"
                  : reservation.pix_method === 'telefone'
                  ? "Copie o número abaixo para entrar em contato sobre o pagamento"
                  : "Copie a chave abaixo e cole no app do seu banco"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Nome da Conta e Banco - exibido quando disponível */}
              {(reservation.pix_account_name || reservation.pix_bank_name) && (
                <div className="flex flex-wrap gap-x-6 gap-y-2 p-3 bg-muted/50 rounded-lg border text-sm">
                  {reservation.pix_account_name && (
                    <div>
                      <p className="text-xs text-muted-foreground">Nome da Conta</p>
                      <p className="font-semibold">{reservation.pix_account_name}</p>
                    </div>
                  )}
                  {reservation.pix_bank_name && (
                    <div>
                      <p className="text-xs text-muted-foreground">Banco</p>
                      <p className="font-semibold">{reservation.pix_bank_name}</p>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg border font-mono text-sm break-all select-all">
                  {reservation.payment_link}
                </div>
                <Button
                  onClick={handleCopyPix}
                  variant={copied ? "default" : "outline"}
                  className="w-full h-11"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">Como pagar:</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                {showQRCode ? (
                  <>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">1.</span>
                      Abra o aplicativo do seu banco
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">2.</span>
                      Escolha a opção Pix e selecione "Pagar com QR Code" ou "Pix Copia e Cola"
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">3.</span>
                      Escaneie o QR Code acima ou cole a chave Pix copiada
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">4.</span>
                      Confirme os dados e finalize o pagamento
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">5.</span>
                      Após realizar o pagamento, clique no botão abaixo para confirmar
                    </li>
                  </>
                ) : reservation.pix_method === 'email' ? (
                  <>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">1.</span>
                      Realize o pagamento via Pix para a chave informada
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">2.</span>
                      Envie o comprovante de pagamento para o e-mail copiado acima
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">3.</span>
                      Aguarde a confirmação do recebimento
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">4.</span>
                      Após realizar o pagamento, clique no botão abaixo para confirmar
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">1.</span>
                      Realize o pagamento via Pix
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">2.</span>
                      Entre em contato pelo número acima para enviar o comprovante
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">3.</span>
                      Aguarde a confirmação do recebimento
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">4.</span>
                      Após realizar o pagamento, clique no botão abaixo para confirmar
                    </li>
                  </>
                )}
              </ol>
            </CardContent>
          </Card>

          {/* WhatsApp Button */}
          <Button
            onClick={handleWhatsAppSend}
            size="lg"
            className="w-full text-base py-3 h-auto whitespace-normal text-center bg-green-600 hover:bg-green-700"
          >
            <MessageCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            Enviar Comprovante via WhatsApp
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Clique no botão acima para enviar seu comprovante de pagamento via WhatsApp.
            Nossa equipe irá verificar e confirmar sua reserva.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default PagamentoPix;