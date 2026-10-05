import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface DbProperty {
  id: string;
  title: string;
  type: "flat" | "apartamento";
  description: string | null;
  address: string | null;
  city: string;
  neighborhood: string | null;
  price_per_night: number;
  max_guests: number;
  amenities: string[];
  images: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Hook for real-time property updates
function usePropertiesRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('properties-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties',
        },
        () => {
          // Invalidate all property-related queries when any change occurs
          queryClient.invalidateQueries({ queryKey: ["properties"] });
          queryClient.invalidateQueries({ queryKey: ["property"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

// Sort properties: flats first, then apartamentos
function sortByType(properties: DbProperty[]): DbProperty[] {
  return [...properties].sort((a, b) => {
    if (a.type === "flat" && b.type !== "flat") return -1;
    if (a.type !== "flat" && b.type === "flat") return 1;
    return 0;
  });
}

export const fetchProperties = async (): Promise<DbProperty[]> => {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("is_active", true)
    .order("type", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Transform and sort: flats first, then apartamentos
  const transformed = (data || []).map((p) => ({
    ...p,
    amenities: Array.isArray(p.amenities) ? p.amenities : [],
    images: Array.isArray(p.images) ? p.images : [],
  })) as DbProperty[];

  return sortByType(transformed);
};

export function useProperties() {
  // Enable real-time updates
  usePropertiesRealtime();

  return useQuery({
    queryKey: ["properties"],
    queryFn: fetchProperties,
    staleTime: 60_000,
  });
}

export function useProperty(id: string) {
  // Enable real-time updates
  usePropertiesRealtime();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["property", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      return {
        ...data,
        amenities: Array.isArray(data.amenities) ? data.amenities : [],
        images: Array.isArray(data.images) ? data.images : [],
      } as DbProperty;
    },
    enabled: !!id,
    // Render instantly from the cached list while fresh data loads
    placeholderData: () =>
      queryClient
        .getQueryData<DbProperty[]>(["properties"])
        ?.find((p) => p.id === id),
  });
}

export function usePropertiesByType(type: "flat" | "apartamento" | "all") {
  // Enable real-time updates
  usePropertiesRealtime();

  return useQuery({
    queryKey: ["properties"],
    queryFn: fetchProperties,
    staleTime: 60_000,
    select: (data) =>
      type === "all" ? data : data.filter((p) => p.type === type),
  });
}
