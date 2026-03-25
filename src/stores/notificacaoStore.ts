import { create } from 'zustand';

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: 'info' | 'alerta' | 'urgente';
  lida: boolean;
}

interface NotificacaoStore {
  notificacoes: Notificacao[];
  adicionarNotificacao: (n: Omit<Notificacao, 'id' | 'lida'>) => void;
  marcarLida: (id: string) => void;
}

export const useNotificacaoStore = create<NotificacaoStore>((set) => ({
  notificacoes: [],
  adicionarNotificacao: (n) =>
    set((state) => ({
      notificacoes: [{ ...n, id: `n-${Date.now()}`, lida: false }, ...state.notificacoes],
    })),
  marcarLida: (id) =>
    set((state) => ({
      notificacoes: state.notificacoes.map((n) => (n.id === id ? { ...n, lida: true } : n)),
    })),
}));
