import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  nome: string;
  email: string;
  papel: 'GESTOR' | 'ATENDENTE' | 'ADMIN';
  aprovado: boolean;
}

interface AuthStore {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  initialize: () => Promise<void>;
}

const SESSION_KEY = 'tfa_session_user';

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    // Recupera sessão salva no localStorage
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as User;
        set({ user: parsed });
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }

    set({ initialized: true });
  },

  login: async (email: string, senha: string) => {
    set({ loading: true });
    try {
      // Busca diretamente na tabela de solicitacoes_acesso
      const { data: sol, error } = await supabase
        .from('solicitacoes_acesso')
        .select('id, nome, email, senha, status')
        .eq('email', email)
        .maybeSingle() as { data: any; error: any };

      if (error) {
        return { success: false, error: 'Erro ao consultar o banco de dados.' };
      }

      if (!sol) {
        return { success: false, error: 'Usuário não encontrado.' };
      }

      if (sol.senha !== senha) {
        return { success: false, error: 'Senha incorreta.' };
      }

      if (sol.status !== 'APROVADO') {
        return { success: false, error: 'Sua conta ainda não foi aprovada pelo administrador.' };
      }

      // Cria o objeto de sessão do usuário aprovado
      const user: User = {
        id: sol.id,
        nome: sol.nome,
        email: sol.email,
        papel: 'GESTOR',
        aprovado: true,
      };

      // Salva a sessão no localStorage
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      set({ user });

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado.';
      return { success: false, error: msg };
    } finally {
      set({ loading: false });
    }
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
    set({ user: null });
  },
}));
