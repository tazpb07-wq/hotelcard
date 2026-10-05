import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminStats {
  activeReservations: number;
  totalUsers: number;
  activeProperties: number;
  monthlyRevenue: number;
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats>({
    activeReservations: 0,
    totalUsers: 0,
    activeProperties: 0,
    monthlyRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Fetch active reservations (pendente or confirmada)
      const { count: reservationsCount } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pendente', 'confirmada']);

      // Fetch total users
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch active properties
      const { count: propertiesCount } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Calculate monthly revenue (this month's confirmed reservations)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { data: monthlyReservations } = await supabase
        .from('reservations')
        .select('total_price')
        .gte('created_at', startOfMonth.toISOString())
        .neq('status', 'cancelada');

      const monthlyRevenue = monthlyReservations?.reduce((sum, r) => sum + Number(r.total_price), 0) || 0;

      setStats({
        activeReservations: reservationsCount || 0,
        totalUsers: usersCount || 0,
        activeProperties: propertiesCount || 0,
        monthlyRevenue,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchStats, 15000);

    return () => clearInterval(interval);
  }, []);

  return { stats, loading, refetch: fetchStats };
}
