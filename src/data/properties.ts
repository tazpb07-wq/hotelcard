import flat1 from "@/assets/flat-1.jpg";
import flat2 from "@/assets/flat-2.jpg";
import flat3 from "@/assets/flat-3.jpg";
import apartment1 from "@/assets/apartment-1.jpg";
import apartment2 from "@/assets/apartment-2.jpg";
import apartment3 from "@/assets/apartment-3.jpg";

export interface Property {
  id: string;
  name: string;
  type: "flat" | "apartment";
  description: string;
  shortDescription: string;
  image: string;
  images: string[];
  price: number;
  priceUnit: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  amenities: string[];
  location: string;
  available: boolean;
}

export const properties: Property[] = [
  {
    id: "flat-1",
    name: "Flat Aconchego",
    type: "flat",
    description: "Flat moderno e aconchegante, perfeito para estadias curtas ou longas. Ambiente tranquilo com excelente iluminação natural, decoração contemporânea e espaço de trabalho integrado. Ideal para profissionais e casais.",
    shortDescription: "Flat moderno com espaço de trabalho integrado",
    image: flat1,
    images: [flat1, flat2, flat3],
    price: 150,
    priceUnit: "noite",
    bedrooms: 1,
    bathrooms: 1,
    area: 35,
    amenities: ["Wi-Fi", "Ar condicionado", "TV", "Cozinha equipada", "Estacionamento"],
    location: "Centro, João Pessoa - PB",
    available: true,
  },
  {
    id: "flat-2",
    name: "Flat Executivo",
    type: "flat",
    description: "Flat executivo com cozinha completa e área de estar confortável. Design moderno e funcional, ideal para viagens de negócios ou lazer. Localização privilegiada com fácil acesso a restaurantes e serviços.",
    shortDescription: "Flat executivo com cozinha completa",
    image: flat2,
    images: [flat2, flat1, flat3],
    price: 180,
    priceUnit: "noite",
    bedrooms: 1,
    bathrooms: 1,
    area: 40,
    amenities: ["Wi-Fi", "Ar condicionado", "TV Smart", "Cozinha completa", "Lavanderia", "Estacionamento"],
    location: "Manaíra, João Pessoa - PB",
    available: true,
  },
  {
    id: "flat-3",
    name: "Flat Premium",
    type: "flat",
    description: "Flat premium com acabamento de alto padrão, banheiro em mármore e amenidades de luxo. Experiência sofisticada para hóspedes exigentes que buscam conforto e elegância.",
    shortDescription: "Flat premium com acabamento de luxo",
    image: flat3,
    images: [flat3, flat1, flat2],
    price: 220,
    priceUnit: "noite",
    bedrooms: 1,
    bathrooms: 1,
    area: 45,
    amenities: ["Wi-Fi 5G", "Ar condicionado split", "TV 55\"", "Cozinha gourmet", "Amenities premium", "Estacionamento coberto"],
    location: "Tambaú, João Pessoa - PB",
    available: true,
  },
  {
    id: "apartment-1",
    name: "Apartamento Vista Mar",
    type: "apartment",
    description: "Apartamento espaçoso com vista deslumbrante para o mar. Sala ampla com varanda, perfeito para famílias ou grupos que desejam desfrutar do melhor da orla pessoense.",
    shortDescription: "Apartamento com vista panorâmica para o mar",
    image: apartment1,
    images: [apartment1, apartment2, apartment3],
    price: 350,
    priceUnit: "noite",
    bedrooms: 2,
    bathrooms: 2,
    area: 85,
    amenities: ["Wi-Fi", "Ar condicionado", "TV Smart", "Cozinha completa", "Varanda", "Vista mar", "Estacionamento", "Piscina"],
    location: "Cabo Branco, João Pessoa - PB",
    available: true,
  },
  {
    id: "apartment-2",
    name: "Apartamento Família",
    type: "apartment",
    description: "Apartamento amplo ideal para famílias, com quartos espaçosos e área de convivência generosa. Decoração elegante e clássica, com closet e banheiro suíte master.",
    shortDescription: "Apartamento espaçoso para toda a família",
    image: apartment2,
    images: [apartment2, apartment1, apartment3],
    price: 400,
    priceUnit: "noite",
    bedrooms: 3,
    bathrooms: 2,
    area: 120,
    amenities: ["Wi-Fi", "Ar condicionado central", "3 TVs", "Cozinha completa", "Área de serviço", "Closet", "2 vagas estacionamento"],
    location: "Altiplano, João Pessoa - PB",
    available: true,
  },
  {
    id: "apartment-3",
    name: "Cobertura Luxo",
    type: "apartment",
    description: "Cobertura de luxo com piscina privativa e área gourmet. Vista panorâmica da cidade, acabamento premium e experiência única de hospedagem.",
    shortDescription: "Cobertura com piscina privativa",
    image: apartment3,
    images: [apartment3, apartment1, apartment2],
    price: 650,
    priceUnit: "noite",
    bedrooms: 3,
    bathrooms: 3,
    area: 180,
    amenities: ["Wi-Fi 5G", "Ar condicionado central", "Home theater", "Cozinha gourmet", "Piscina privativa", "Churrasqueira", "3 vagas", "Vista 360°"],
    location: "Bessa, João Pessoa - PB",
    available: true,
  },
];

export const getPropertyById = (id: string): Property | undefined => {
  return properties.find((p) => p.id === id);
};

export const getFlats = (): Property[] => {
  return properties.filter((p) => p.type === "flat");
};

export const getApartments = (): Property[] => {
  return properties.filter((p) => p.type === "apartment");
};
