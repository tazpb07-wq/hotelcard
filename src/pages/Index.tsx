import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { HeroCarousel } from "@/components/HeroCarousel";
import { MyReservationBanner } from "@/components/MyReservationBanner";
import { PropertyCard, PropertyGridSkeleton } from "@/components/PropertyCard";
import { Reveal } from "@/components/Reveal";
import { useProperties } from "@/hooks/useProperties";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  Clock, 
  MapPin, 
  Star,
  Phone
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Segurança Total",
    description: "Imóveis verificados e locação segura com contrato",
  },
  {
    icon: Clock,
    title: "Suporte 24h",
    description: "Atendimento disponível a qualquer momento",
  },
  {
    icon: MapPin,
    title: "Localizações Prime",
    description: "Os melhores bairros de João Pessoa",
  },
  {
    icon: Star,
    title: "Qualidade Premium",
    description: "Imóveis selecionados de alto padrão",
  },
];

const Index = () => {
  const { data: properties, isLoading } = useProperties();

  return (
    <Layout>
      {/* Active reservation — shown first when this device has a booking */}
      <MyReservationBanner />

      {/* Hero Carousel */}
      <HeroCarousel />

      {/* Features Section */}
      <section className="py-12 md:py-16 bg-secondary">
        <div className="container mx-auto px-4">
          <Reveal className="text-center mb-8 md:mb-10">
            <span className="eyebrow">Nossos Diferenciais</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mt-3">
              Hospedagem com Confiança
            </h2>
          </Reveal>
          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group flex items-start gap-4 p-5 md:p-6 bg-card rounded-2xl shadow-soft border border-border/60 hover:shadow-card hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl accent-gradient flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300">
                  <feature.icon className="w-5 h-5 text-white" strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-foreground mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* All Properties */}
      <section className="py-12 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <Reveal className="text-center mb-8 md:mb-12">
            <span className="eyebrow">Portfólio</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mt-3 mb-3">
              Nossos Imóveis
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Confira todos os flats e apartamentos disponíveis para você ter uma experiência única em João Pessoa
            </p>
          </Reveal>

          {isLoading ? (
            <PropertyGridSkeleton />
          ) : properties && properties.length > 0 ? (
            <Reveal stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </Reveal>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhum imóvel disponível no momento.</p>
            </div>
          )}
        </div>
      </section>

      {/* About Section */}
      <section className="py-14 md:py-20 bg-foreground text-background">
        <div className="container mx-auto px-4">
          <Reveal className="max-w-3xl mx-auto text-center space-y-5">
            <span className="eyebrow">Sobre Nós</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">
              Sua Estadia Perfeita em João Pessoa
            </h2>
            <p className="text-background/80 text-lg leading-relaxed">
              Com uma seleção exclusiva de flats e apartamentos, oferecemos o melhor em hospedagem 
              na cidade. Localização privilegiada, conforto e segurança para você e sua família.
            </p>
            <p className="text-background/80 leading-relaxed">
              Trabalhamos com imóveis em Tambaú, Manaíra, Cabo Branco, Bessa e outras regiões 
              nobres da orla pessoense. Cada propriedade é cuidadosamente selecionada para 
              garantir sua satisfação.
            </p>
            <div className="pt-5">
              <Button variant="gold" size="lg" asChild>
                <Link to="/contato">
                  <Phone className="w-4 h-4 mr-2" />
                  Entre em Contato
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-20 bg-secondary">
        <div className="container mx-auto px-4">
          <Reveal className="accent-gradient rounded-3xl p-8 md:p-14 text-center shadow-elevated">
            <span className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
              Reserve Agora
            </span>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white mt-3 mb-4">
              Pronto para sua próxima hospedagem?
            </h2>
            <p className="text-white/90 mb-8 max-w-xl mx-auto">
              Explore nossos imóveis e encontre a hospedagem perfeita 
              para sua estadia em João Pessoa.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-white text-foreground font-semibold border-2 border-white hover:bg-white/90" asChild>
                <Link to="/produtos">Explorar Imóveis</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
