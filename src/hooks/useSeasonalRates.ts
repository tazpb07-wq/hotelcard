import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SeasonalRate {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  daily_price: number;
  label: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface SeasonalRateInput {
  property_id: string;
  start_date: string;
  end_date: string;
  daily_price: number;
  label?: string | null;
  priority?: number;
}

// Fetch seasonal rates for a specific property
export function useSeasonalRates(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["seasonal-rates", propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      
      const { data, error } = await supabase
        .from("seasonal_rates")
        .select("*")
        .eq("property_id", propertyId)
        .order("start_date", { ascending: true });

      if (error) throw error;
      return data as SeasonalRate[];
    },
    enabled: !!propertyId,
  });
}

export interface SeasonalRateWithProperty extends SeasonalRate {
  property: { title: string; price_per_night: number } | null;
}

// Fetch seasonal rates across all properties (admin overview)
export function useAllSeasonalRates() {
  return useQuery({
    queryKey: ["seasonal-rates", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seasonal_rates")
        .select("*, property:properties(title, price_per_night)")
        .order("start_date", { ascending: true });

      if (error) throw error;
      return data as SeasonalRateWithProperty[];
    },
  });
}

// Mutations that invalidate every seasonal-rates query (used by the
// "Alta Temporada" admin tab which manages rates for all properties)
export function useSeasonalRateMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["seasonal-rates"] });

  const createRate = useMutation({
    mutationFn: async (input: SeasonalRateInput) => {
      const { data, error } = await supabase
        .from("seasonal_rates")
        .insert([input])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const updateRate = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SeasonalRateInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("seasonal_rates")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteRate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("seasonal_rates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { createRate, updateRate, deleteRate };
}

// Hook for admin to manage seasonal rates
export function useSeasonalRatesAdmin(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: rates, isLoading, error, refetch } = useSeasonalRates(propertyId);

  const createRate = useMutation({
    mutationFn: async (input: SeasonalRateInput) => {
      const { data, error } = await supabase
        .from("seasonal_rates")
        .insert([input])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasonal-rates", propertyId] });
    },
  });

  const updateRate = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SeasonalRateInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("seasonal_rates")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasonal-rates", propertyId] });
    },
  });

  const deleteRate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("seasonal_rates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasonal-rates", propertyId] });
    },
  });

  return {
    rates: rates || [],
    isLoading,
    error,
    refetch,
    createRate,
    updateRate,
    deleteRate,
  };
}
