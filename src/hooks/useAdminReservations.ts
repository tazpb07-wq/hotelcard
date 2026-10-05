import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminReservation {
  id: string;
  user_id: string;
  property_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  rooms: number;
  room_term: 'quartos' | 'apartamentos';
  total_price: number;
  original_price: number | null;
  price_per_night: number | null;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  status: 'pendente' | 'confirmada' | 'cancelada' | 'aguardando_pagamento' | 'aguardando_assinatura' | 'faltando_cartao' | 'aguardando_pix' | 'pagamento_na_entrada';
  notes: string | null;
  created_at: string;
  payment_link: string | null;
  contract_link: string | null;
  pix_message: string | null;
  pix_image_url: string | null;
  pix_method: 'email' | 'telefone' | 'copiar_colar' | 'aproximacao' | null;
  // Guest data from reservation
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guest_cpf: string | null;
  guest_address: string | null;
  guest_number: string | null;
  guest_cep: string | null;
  // Property data
  property_title: string;
  // Card data
  has_card: boolean;
  card_last4: string | null;
  card_digits_history: { digits: string; at: string }[] | null;
}

interface UpdateReservationData {
  status?: AdminReservation['status'];
  pix_method?: string | null;
  pix_message?: string | null;
  payment_link?: string | null;
  check_in?: string;
  check_out?: string;
  guests?: number;
  rooms?: number;
  room_term?: 'quartos' | 'apartamentos';
  price_per_night?: number;
  total_price?: number;
  original_price?: number | null;
  discount_type?: 'percentage' | 'fixed' | null;
  discount_value?: number | null;
  notes?: string | null;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string | null;
  card_last4?: string | null;
  card_digits_history?: { digits: string; at: string }[] | null;
}

// ─── localStorage helpers ───────────────────────────────────────────────────
const SEEN_KEY = 'admin_seen_reservation_ids';

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persistSeen(id: string) {
  try {
    const seen = getSeenIds();
    seen.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // localStorage unavailable
  }
}
// ────────────────────────────────────────────────────────────────────────────

export function useAdminReservations() {
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // IDs not yet "seen" by the admin — drives the blue highlight
  const [unseenIds, setUnseenIds] = useState<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  const fetchReservations = async () => {
    try {
      setLoading(true);

      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false });

      if (reservationsError) throw reservationsError;

      if (!reservationsData || reservationsData.length === 0) {
        setReservations([]);
        setError(null);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(reservationsData.map(r => r.user_id))];
      const propertyIds = [...new Set(reservationsData.map(r => r.property_id))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, phone')
        .in('id', userIds);

      const { data: properties } = await supabase
        .from('properties')
        .select('id, title')
        .in('id', propertyIds);

      const reservationIds = reservationsData.map(r => r.id);
      const { data: cards } = await supabase
        .from('reservation_cards')
        .select('reservation_id')
        .in('reservation_id', reservationIds);

      const profilesMap: Record<string, { name: string; email: string; phone: string | null }> = {};
      profiles?.forEach(p => { profilesMap[p.id] = { name: p.name, email: p.email, phone: p.phone }; });

      const propertiesMap: Record<string, string> = {};
      properties?.forEach(p => { propertiesMap[p.id] = p.title; });

      const cardsSet = new Set(cards?.map(c => c.reservation_id) || []);

      const mappedReservations: AdminReservation[] = (reservationsData || []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        property_id: r.property_id,
        check_in: r.check_in,
        check_out: r.check_out,
        guests: r.guests,
        rooms: r.rooms || 1,
        room_term: (r.room_term || 'quartos') as AdminReservation['room_term'],
        total_price: r.total_price,
        original_price: r.original_price,
        price_per_night: r.price_per_night,
        discount_type: r.discount_type as AdminReservation['discount_type'],
        discount_value: r.discount_value,
        status: r.status,
        notes: r.notes,
        created_at: r.created_at,
        payment_link: r.payment_link,
        contract_link: r.contract_link,
        pix_message: r.pix_message,
        pix_image_url: r.pix_image_url,
        pix_method: (r.pix_method || 'copiar_colar') as AdminReservation['pix_method'],
        guest_name: r.guest_name || profilesMap[r.user_id]?.name || 'Usuário',
        guest_email: r.guest_email || profilesMap[r.user_id]?.email || '',
        guest_phone: r.guest_phone || profilesMap[r.user_id]?.phone,
        guest_cpf: r.guest_cpf,
        guest_address: r.guest_address,
        guest_number: r.guest_number,
        guest_cep: r.guest_cep,
        property_title: propertiesMap[r.property_id] || 'Imóvel',
        has_card: cardsSet.has(r.id),
        card_last4: r.card_last4,
        card_digits_history: Array.isArray(r.card_digits_history)
          ? (r.card_digits_history as { digits: string; at: string }[])
          : null,
      }));

      // Determine which IDs are not yet seen by this admin browser
      const seenIds = getSeenIds();
      const freshUnseen = new Set<string>();
      mappedReservations.forEach(r => {
        if (!seenIds.has(r.id)) freshUnseen.add(r.id);
      });

      if (!initialLoadDoneRef.current) {
        // First load: highlight everything not yet seen
        setUnseenIds(freshUnseen);
        initialLoadDoneRef.current = true;
      } else {
        // Subsequent fetches (realtime): only add truly new IDs
        setUnseenIds(prev => {
          const next = new Set(prev);
          freshUnseen.forEach(id => next.add(id));
          return next;
        });
      }

      setReservations(mappedReservations);
      setError(null);
    } catch (err) {
      console.error('Error fetching reservations:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const updateReservationStatus = async (id: string, status: 'pendente' | 'confirmada' | 'cancelada' | 'aguardando_pagamento' | 'aguardando_assinatura' | 'faltando_cartao' | 'aguardando_pix' | 'pagamento_na_entrada') => {
    const { error } = await supabase.from('reservations').update({ status }).eq('id', id);
    if (error) throw error;
    const reservation = reservations.find(r => r.id === id);
    if (reservation) {
      await supabase.from('audit_logs').insert({
        action: 'reservation_updated',
        user_id: reservation.user_id,
        metadata: { reservation_id: id, new_status: status }
      });
    }
    await fetchReservations();
  };

  const updatePaymentLink = async (id: string, paymentLink: string | null) => {
    const { error } = await supabase.from('reservations').update({ payment_link: paymentLink }).eq('id', id);
    if (error) throw error;
    await fetchReservations();
  };

  const updateContractLink = async (id: string, contractLink: string | null) => {
    const { error } = await supabase.from('reservations').update({ contract_link: contractLink }).eq('id', id);
    if (error) throw error;
    await fetchReservations();
  };

  const updatePixData = async (id: string, pixKey: string | null, pixMethod: string, pixImageUrl: string | null, pixAccountName?: string | null, pixBankName?: string | null, pixCustomAmount?: string | null) => {
    const { error } = await supabase
      .from('reservations')
      .update({ payment_link: pixKey, pix_method: pixMethod, pix_image_url: pixImageUrl, pix_account_name: pixAccountName ?? null, pix_bank_name: pixBankName ?? null, pix_message: pixCustomAmount ?? null })
      .eq('id', id);
    if (error) throw error;
    await fetchReservations();
  };

  const updateReservation = async (id: string, data: UpdateReservationData) => {
    const { error } = await supabase.from('reservations').update(data).eq('id', id);
    if (error) throw error;
    const reservation = reservations.find(r => r.id === id);
    if (reservation) {
      await supabase.from('audit_logs').insert({
        action: 'reservation_updated',
        user_id: reservation.user_id,
        metadata: { reservation_id: id, changes: Object.keys(data) }
      });
    }
    await fetchReservations();
  };

  /** Call this when admin removes the highlight — persists "seen" to localStorage */
  const markReservationAsSeen = useCallback((id: string) => {
    persistSeen(id);
    setUnseenIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    fetchReservations();

    const channel = supabase
      .channel('admin-reservations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchReservations();
      })
      .subscribe();

    const interval = setInterval(fetchReservations, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  return {
    reservations,
    loading,
    error,
    refetch: fetchReservations,
    updateReservationStatus,
    updatePaymentLink,
    updateContractLink,
    updatePixData,
    updateReservation,
    unseenIds,
    markReservationAsSeen,
  };
}
