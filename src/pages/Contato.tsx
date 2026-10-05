import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Send,
  MessageCircle
} from "lucide-react";
import { toast } from "sonner";
import { maskPhone } from "@/lib/masks";
import { Reveal } from "@/components/Reveal";

const Contato = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskPhone(e.target.value);
    setFormData(prev => ({ ...prev, phone: masked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Por favor, preencha os campos obrigatórios");
      return;
    }

    setIsLoading(true);
    
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Mensagem enviada com sucesso! Entraremos em contato em breve.");
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
    }, 1500);
  };

  const openWhatsApp = () => {
    const phone = "5583987344520";
    const message = encodeURIComponent("Olá! Gostaria de saber mais sobre os imóveis disponíveis.");
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  return (
    <Layout>
      {/* Header */}
      <section className="bg-foreground text-background py-10 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <span className="eyebrow">Fale Conosco</span>
          <h1 className="font-display text-3xl md:text-5xl font-bold mt-3 mb-3">
            Entre em Contato
          </h1>
          <p className="text-background/80 text-base md:text-lg max-w-2xl mx-auto">
            Estamos prontos para ajudá-lo a encontrar o imóvel perfeito. 
            Fale conosco por WhatsApp ou envie uma mensagem.
          </p>
        </div>
      </section>

      <section className="py-10 md:py-16 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
            {/* Contact Info */}
            <Reveal className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold mb-5">
                  Informações de Contato
                </h2>
                
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl accent-gradient flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Phone className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Telefone / WhatsApp</h3>
                      <p className="text-muted-foreground text-sm mt-0.5">(83) 9 8734-4520</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl accent-gradient flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">E-mail</h3>
                      <p className="text-muted-foreground text-sm mt-0.5">contato@dfimoveis.com.br</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl accent-gradient flex items-center justify-center flex-shrink-0 shadow-sm">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Localização</h3>
                      <p className="text-muted-foreground text-sm mt-0.5">João Pessoa, Paraíba - Brasil</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl accent-gradient flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Horário de Atendimento</h3>
                      <p className="text-muted-foreground text-sm mt-0.5">Segunda a Sábado: 8h às 18h</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* WhatsApp CTA */}
              <div className="bg-green-50 rounded-2xl p-6 border border-green-200 shadow-soft">
                <div className="flex items-center gap-3 mb-3">
                  <MessageCircle className="w-6 h-6 text-green-600" />
                  <h3 className="font-semibold text-green-800">Atendimento Rápido</h3>
                </div>
                <p className="text-green-700 text-sm mb-4">
                  Precisa de uma resposta rápida? Fale diretamente conosco pelo WhatsApp!
                </p>
                <Button
                  onClick={openWhatsApp}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Iniciar Conversa
                </Button>
              </div>

              {/* Agent Info */}
              <div className="bg-card rounded-2xl p-5 md:p-6 border border-border/60 shadow-soft">
                <h3 className="font-display text-xl font-semibold mb-2">Daniel Ferreira</h3>
                <p className="text-muted-foreground text-sm">Corretor de Imóveis</p>
                <p className="text-primary text-[11px] font-bold uppercase tracking-[0.2em] mt-2">CRECI 6539</p>
              </div>
            </Reveal>

            {/* Contact Form */}
            <Reveal delay={100} className="bg-card rounded-2xl p-6 md:p-8 shadow-card border border-border/60">
              <h2 className="font-display text-2xl font-bold mb-6">
                Envie uma Mensagem
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      placeholder="Seu nome"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      placeholder="00 0 0000-0000"
                      value={formData.phone}
                      onChange={handlePhoneChange}
                      maxLength={16}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Assunto</Label>
                    <Input
                      id="subject"
                      placeholder="Reserva, dúvida, etc."
                      value={formData.subject}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem</Label>
                  <Textarea
                    id="message"
                    placeholder="Escreva sua mensagem..."
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  />
                </div>

                <Button
                  type="submit"
                  variant="gold"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    "Enviando..."
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar Mensagem
                    </>
                  )}
                </Button>
              </form>
            </Reveal>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Contato;
