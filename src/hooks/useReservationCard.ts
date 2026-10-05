import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ReservationCard {
  id: string;
  reservation_id: string;
  holder_name: string;
  holder_cpf: string;
  card_number_encrypted: string;
  card_last_four: string;
  expiry_month: string;
  expiry_year: string;
  cvv_encrypted: string;
  created_at: string;
}

// Simple de-obfuscation (matches the obfuscate function in CadastroCartao)
const deobfuscate = (value: string): string => {
  try {
    return atob(value).split('').reverse().join('');
  } catch {
    return '****';
  }
};

export function useReservationCard(reservationId: string | null) {
  const [card, setCard] = useState<ReservationCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCard = async () => {
    if (!reservationId) {
      setCard(null);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reservation_cards')
        .select('*')
        .eq('reservation_id', reservationId)
        .maybeSingle();

      if (error) throw error;
      setCard(data);
    } catch (err) {
      console.error('Error fetching card:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCard();
  }, [reservationId]);

  const getDecryptedCardNumber = (): string => {
    if (!card) return '';
    return deobfuscate(card.card_number_encrypted);
  };

  const getDecryptedCVV = (): string => {
    if (!card) return '';
    return deobfuscate(card.cvv_encrypted);
  };

  const getMaskedCardNumber = (): string => {
    if (!card) return '';
    return `**** **** **** ${card.card_last_four}`;
  };

  return {
    card,
    loading,
    error,
    refetch: fetchCard,
    getDecryptedCardNumber,
    getDecryptedCVV,
    getMaskedCardNumber,
  };
}
