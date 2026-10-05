import { Link } from "react-router-dom";
import { Users, MapPin } from "lucide-react";
import { DbProperty } from "@/hooks/useProperties";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PropertyCardProps {
  property: DbProperty;
}

export function PropertyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-card rounded-2xl overflow-hidden border border-border/60 shadow-sm flex flex-col"
        >
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="p-4 flex flex-col flex-1 gap-2.5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-10 w-full rounded-xl mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PropertyCard({ property }: PropertyCardProps) {
  const mainImage = property.images[0] || "/placeholder.svg";

  return (
    <div className="group bg-card rounded-2xl overflow-hidden border border-border/60 shadow-sm hover:shadow-card transition-all duration-300 hover:-translate-y-1 flex flex-col">
      {/* Image */}
      <Link to={`/produto/${property.id}`} className="relative block aspect-[4/3] overflow-hidden">
        <img
          src={mainImage}
          alt={property.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20 pointer-events-none" />

        <div className="absolute top-3 left-3">
          <Badge
            variant={property.type === "flat" ? "default" : "secondary"}
            className="shadow-md backdrop-blur-sm uppercase tracking-wider text-[10px] font-bold"
          >
            {property.type === "flat" ? "Flat" : "Apartamento"}
          </Badge>
        </div>
        {property.is_active && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-green-500/95 backdrop-blur-sm text-white hover:bg-green-600 shadow-md uppercase tracking-wider text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-pulse" />
              Disponível
            </Badge>
          </div>
        )}

        {/* Price overlay */}
        <div className="absolute bottom-3 left-3 text-white drop-shadow-lg">
          <span className="text-2xl font-bold tracking-tight">
            R$ {Number(property.price_per_night).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </span>
          <span className="text-white/80 text-xs font-medium uppercase tracking-wider"> /diária</span>
        </div>
      </Link>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-display text-lg font-semibold text-foreground truncate group-hover:text-primary transition-colors">
          {property.title}
        </h3>
        <div className="flex items-center gap-1.5 mt-1 text-muted-foreground text-xs">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
          <span className="truncate">{property.neighborhood}, {property.city}</span>
        </div>

        <p className="text-muted-foreground text-sm line-clamp-2 min-h-[40px] mt-2.5">
          {property.description}
        </p>

        <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-3 pt-3 border-t border-border/60">
          <Users className="w-4 h-4 text-primary" />
          <span>Até {property.max_guests} hóspedes</span>
        </div>

        <Button variant="gold" className="w-full mt-3.5 rounded-xl" asChild>
          <Link to={`/produto/${property.id}`}>Ver Detalhes</Link>
        </Button>
      </div>
    </div>
  );
}
