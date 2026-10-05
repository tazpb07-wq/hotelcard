import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { PropertyCard, PropertyGridSkeleton } from "@/components/PropertyCard";
import { MyReservationBanner } from "@/components/MyReservationBanner";
import { Reveal } from "@/components/Reveal";
import { usePropertiesByType } from "@/hooks/useProperties";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterType = "all" | "flat" | "apartamento";

const Produtos = () => {
  const [filter, setFilter] = useState<FilterType>("all");
  const { data: properties, isLoading } = usePropertiesByType(filter);

  const allCount = usePropertiesByType("all").data?.length || 0;
  const flatCount = usePropertiesByType("flat").data?.length || 0;
  const apartamentoCount = usePropertiesByType("apartamento").data?.length || 0;

  return (
    <Layout>
      {/* Active reservation banner for returning guests */}
      <MyReservationBanner />

      {/* Header */}
      <section className="bg-foreground text-background py-10 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <span className="eyebrow">Hospedagem</span>
          <h1 className="font-display text-3xl md:text-5xl font-bold mt-3 mb-3">
            Nossos Imóveis
          </h1>
          <p className="text-background/80 text-base md:text-lg max-w-2xl mx-auto">
            Explore nossa seleção de flats e apartamentos em João Pessoa. 
            Encontre a hospedagem perfeita para sua estadia.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="py-5 border-b border-border sticky top-16 md:top-20 bg-background/95 backdrop-blur-sm z-40">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-full px-6 whitespace-nowrap text-xs font-semibold uppercase tracking-wider",
                filter === "all" ? "shadow-md" : "bg-transparent"
              )}
            >
              Todos ({allCount})
            </Button>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant={filter === "flat" ? "default" : "outline"}
                onClick={() => setFilter("flat")}
                className={cn(
                  "rounded-full px-5 whitespace-nowrap text-xs font-semibold uppercase tracking-wider",
                  filter === "flat" ? "shadow-md" : "bg-transparent"
                )}
              >
                Flats ({flatCount})
              </Button>
              <Button
                variant={filter === "apartamento" ? "default" : "outline"}
                onClick={() => setFilter("apartamento")}
                className={cn(
                  "rounded-full px-5 whitespace-nowrap text-xs font-semibold uppercase tracking-wider",
                  filter === "apartamento" ? "shadow-md" : "bg-transparent"
                )}
              >
                Apartamentos ({apartamentoCount})
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Properties Grid */}
      <section className="py-8 md:py-12 bg-secondary">
        <div className="container mx-auto px-4">
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
              <p className="text-muted-foreground">
                Nenhum imóvel encontrado com os filtros selecionados.
              </p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Produtos;
