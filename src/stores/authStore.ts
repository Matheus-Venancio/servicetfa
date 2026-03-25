import { create } from 'zustand';
import { MOCK_USERS } from '@/lib/mockData';

interface User {
  id: string;
  nome: string;
  email: string;
  papel: 'GESTOR' | 'ATENDENTE';
}

interface AuthStore {
  user: User | null;
  token: string | null;
  login: (email: string, senha: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  login: async (email: string, senha: string) => {
    const found = MOCK_USERS.find((u) => u.email === email && u.senha === senha);
    if (found) {
      set({ user: { id: found.id, nome: found.nome, email: found.email, papel: found.papel }, token: 'mock-token' });
      return true;
    }
    return false;
  },
  logout: () => set({ user: null, token: null }),
}));
