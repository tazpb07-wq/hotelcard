import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'admin' | 'client';
  created_at: string;
  reservationCount: number;
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, phone, created_at')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) throw rolesError;

      // Fetch reservation counts per user
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('user_id');
      
      if (reservationsError) throw reservationsError;

      // Count reservations per user
      const reservationCounts: Record<string, number> = {};
      reservations?.forEach(r => {
        reservationCounts[r.user_id] = (reservationCounts[r.user_id] || 0) + 1;
      });

      // Map roles to users
      const rolesMap: Record<string, 'admin' | 'client'> = {};
      roles?.forEach(r => {
        rolesMap[r.user_id] = r.role as 'admin' | 'client';
      });

      // Combine data
      const combinedUsers: AdminUser[] = (profiles || []).map(profile => ({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        role: rolesMap[profile.id] || 'client',
        created_at: profile.created_at,
        reservationCount: reservationCounts[profile.id] || 0,
      }));

      setUsers(combinedUsers);
      setError(null);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    // Subscribe to realtime changes on profiles
    const channel = supabase
      .channel('admin-users-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchUsers();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles' },
        () => {
          fetchUsers();
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds as backup (reduced from 15s to prevent overload)
    const interval = setInterval(fetchUsers, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  return { users, loading, error, refetch: fetchUsers };
}
