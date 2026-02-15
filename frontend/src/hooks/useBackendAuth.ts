import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAPI } from '@/config/api';

export const useBackendAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const syncBackendAuth = async () => {
      try {
        // Verificar se há sessão do Supabase
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user?.email) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        // Sincronizar com backend
        try {
          const backendData = await fetchAPI('/auth/login-supabase', {
            method: 'POST',
            body: { email: session.user.email }
          });

          localStorage.setItem('token', backendData.token);
          localStorage.setItem('user', JSON.stringify(backendData.user));
          setIsAuthenticated(true);
          setError(null);
        } catch (syncError: any) {
          console.error('Erro ao sincronizar com backend:', syncError);
          setError(syncError.message || 'Erro de sincronização com backend');
          // Mesmo com erro, se tem session do Supabase, consideramos autenticado
          setIsAuthenticated(true);
        }
      } catch (err: any) {
        console.error('Erro ao verificar autenticação:', err);
        setError(err.message);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    syncBackendAuth();

    // Escutar mudanças de sessão
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await syncBackendAuth();
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsAuthenticated(false);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return { isAuthenticated, loading, error };
};
