import { create } from 'zustand';
import { Lead, Mensagem, MOCK_LEADS, MOCK_MENSAGENS, RESPOSTAS_LEAD_MOCK } from '@/lib/mockData';

interface ConversaStore {
  leads: Lead[];
  leadSelecionado: Lead | null;
  mensagens: Mensagem[];
  filtroStatus: string;
  filtroSidebar: string;
  busca: string;
  digitando: boolean;
  setLeadSelecionado: (lead: Lead | null) => void;
  setFiltroStatus: (status: string) => void;
  setFiltroSidebar: (filtro: string) => void;
  setBusca: (busca: string) => void;
  enviarMensagem: (conteudo: string, tipo: 'mensagem' | 'nota', atendenteNome: string) => void;
  redistribuirLead: (leadId: string, atendenteNome: string) => void;
  assumirConversa: (leadId: string, gestorNome: string) => void;
  marcarLida: (leadId: string) => void;
  adicionarLead: (lead: Lead) => void;
}

export const useConversaStore = create<ConversaStore>((set, get) => ({
  leads: [...MOCK_LEADS],
  leadSelecionado: null,
  mensagens: [],
  filtroStatus: 'ABERTAS',
  filtroSidebar: 'todas',
  busca: '',
  digitando: false,

  setLeadSelecionado: (lead) => {
    if (lead) {
      const msgs = MOCK_MENSAGENS[lead._id] || [];
      set({ leadSelecionado: lead, mensagens: [...msgs] });
      get().marcarLida(lead._id);
    } else {
      set({ leadSelecionado: null, mensagens: [] });
    }
  },

  setFiltroStatus: (status) => set({ filtroStatus: status }),
  setFiltroSidebar: (filtro) => set({ filtroSidebar: filtro }),
  setBusca: (busca) => set({ busca }),

  marcarLida: (leadId) => {
    set((state) => ({
      leads: state.leads.map((l) => l._id === leadId ? { ...l, naoLidas: 0 } : l),
    }));
  },

  enviarMensagem: (conteudo, tipo, atendenteNome) => {
    const msg: Mensagem = {
      _id: `m-${Date.now()}`,
      origem: tipo === 'nota' ? 'NOTA_INTERNA' : 'ATENDENTE',
      conteudo,
      atendenteNome,
      criadoEm: new Date().toISOString(),
    };
    const lead = get().leadSelecionado;
    set((state) => ({ mensagens: [...state.mensagens, msg] }));

    if (lead) {
      // Save to mock store
      if (!MOCK_MENSAGENS[lead._id]) MOCK_MENSAGENS[lead._id] = [];
      MOCK_MENSAGENS[lead._id].push(msg);

      set((state) => ({
        leads: state.leads.map((l) =>
          l._id === lead._id ? { ...l, ultimaMensagem: conteudo, ultimaMensagemEm: new Date().toISOString() } : l
        ),
      }));
    }

    // Simulate lead response after 3 seconds (only for regular messages)
    if (tipo === 'mensagem' && lead) {
      setTimeout(() => set({ digitando: true }), 1500);
      setTimeout(() => {
        const resposta = RESPOSTAS_LEAD_MOCK[Math.floor(Math.random() * RESPOSTAS_LEAD_MOCK.length)];
        const replyMsg: Mensagem = {
          _id: `m-${Date.now()}-reply`,
          origem: 'LEAD',
          conteudo: resposta,
          criadoEm: new Date().toISOString(),
        };
        if (lead && MOCK_MENSAGENS[lead._id]) MOCK_MENSAGENS[lead._id].push(replyMsg);
        set((state) => {
          if (state.leadSelecionado?._id === lead._id) {
            return { mensagens: [...state.mensagens, replyMsg], digitando: false };
          }
          return {
            digitando: false,
            leads: state.leads.map((l) =>
              l._id === lead._id ? { ...l, naoLidas: l.naoLidas + 1, ultimaMensagem: resposta, ultimaMensagemEm: new Date().toISOString() } : l
            ),
          };
        });
      }, 5000);
    }
  },

  redistribuirLead: (leadId, atendenteNome) => {
    set((state) => ({
      leads: state.leads.map((l) => l._id === leadId ? { ...l, atendenteNome } : l),
      leadSelecionado: state.leadSelecionado?._id === leadId ? { ...state.leadSelecionado, atendenteNome } : state.leadSelecionado,
    }));
  },

  assumirConversa: (leadId, gestorNome) => {
    set((state) => ({
      leads: state.leads.map((l) => l._id === leadId ? { ...l, atendenteNome: gestorNome } : l),
      leadSelecionado: state.leadSelecionado?._id === leadId ? { ...state.leadSelecionado, atendenteNome: gestorNome } : state.leadSelecionado,
    }));
  },

  adicionarLead: (lead) => {
    set((state) => ({ leads: [lead, ...state.leads] }));
  },
}));
