import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import hero1 from "@/assets/hero-1.jpg";
import hero2 from "@/assets/hero-2.jpg";
import hero3 from "@/assets/hero-3.jpg";

const slides = [
  {
    image: hero1,
    title: "Centro Histórico de João Pessoa",
    subtitle: "O Centro de João Pessoa combina charme histórico e modernidade, com ruas de paralelepípedos, arquitetura colonial e uma rica cultura local. Hospede-se perto de tudo, com fácil acesso a pontos turísticos, restaurantes e as belas praias da cidade.",
  },
  {
    image: hero2,
    title: "Praias do Cabo Branco",
    subtitle: "Com águas cristalinas e areia dourada, as praias do Cabo Branco oferecem um cenário perfeito para relaxar e aproveitar o clima tropical, com o famoso Farol do Cabo Branco como um dos seus principais atrativos.",
  },
  {
    image: hero3,
    title: "Praias de Jacumã",
    subtitle: "As praias de Jacumã oferecem um paraíso tranquilo, com águas mornas, falésias coloridas e um ambiente perfeito para relaxar. Ideal para quem busca um refúgio de paz, com belas paisagens e a natureza preservada.",
  },
];

export function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <div className="relative h-[68vh] min-h-[440px] md:h-[80vh] md:min-h-[600px] w-full overflow-hidden">
      {/* Slides */}
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentSlide ? "opacity-100" : "opacity-0"
          }`}
        >
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
      ))}

      {/* Content */}
      <div className="absolute inset-0 flex items-center">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl space-y-4 md:space-y-6">
            <div
              key={`eyebrow-${currentSlide}`}
              className="flex items-center gap-3 animate-fade-up"
            >
              <span className="h-px w-10 bg-accent" />
              <span className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.3em] text-white/85">
                João Pessoa · Paraíba
              </span>
            </div>
            <h1
              key={`title-${currentSlide}`}
              className="font-display text-3xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.1] animate-fade-up"
            >
              {slides[currentSlide].title}
            </h1>
            <p
              key={`subtitle-${currentSlide}`}
              className="text-base md:text-lg text-white/85 leading-relaxed animate-fade-up line-clamp-4 md:line-clamp-none"
              style={{ animationDelay: "0.15s" }}
            >
              {slides[currentSlide].subtitle}
            </p>
            <div
              className="flex flex-col sm:flex-row gap-3 pt-1 animate-fade-up"
              style={{ animationDelay: "0.3s" }}
            >
              <Button variant="gold" size="xl" asChild>
                <Link to="/produtos">Ver Imóveis</Link>
              </Button>
              <Button variant="heroOutline" size="xl" className="border-white/40 text-white hover:bg-white/10" asChild>
                <Link to="/contato">Fale Conosco</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
        aria-label="Next slide"
      >
        <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-[3px] rounded-full transition-all duration-300 ${
              index === currentSlide
                ? "bg-accent w-10"
                : "bg-white/40 w-6 hover:bg-white/60"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
