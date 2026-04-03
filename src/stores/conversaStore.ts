import { create } from 'zustand';
import { Lead, Mensagem, MOCK_LEADS, MOCK_MENSAGENS, RESPOSTAS_LEAD_MOCK } from '@/lib/mockData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ConversaStore {
  leads: Lead[];
  leadSelecionado: Lead | null;
  mensagens: Mensagem[];
  filtroStatus: string;
  filtroSidebar: string;
  busca: string;
  digitando: boolean;
  carregandoLeads: boolean;
  carregandoMensagens: boolean;
  
  setLeadSelecionado: (lead: Lead | null) => void;
  setFiltroStatus: (status: string) => void;
  setFiltroSidebar: (filtro: string) => void;
  setBusca: (busca: string) => void;
  enviarMensagem: (conteudo: string, tipo: 'mensagem' | 'nota', atendenteNome: string) => Promise<void>;
  redistribuirLead: (leadId: string, atendenteNome: string) => void;
  assumirConversa: (leadId: string, gestorNome: string) => void;
  marcarLida: (leadId: string) => void;
  adicionarLead: (lead: Lead) => void;
  
  carregarLeads: () => Promise<void>;
  carregarMensagens: (leadId: string) => Promise<void>;
  inscreverRealtime: () => void;
}

const mapConversationToLead = (conv: any): Lead => ({
  _id: conv.id,
  nome: conv.contact_name || conv.contact_phone,
  telefone: conv.contact_phone,
  status: (conv.status || 'NOVO') as any,
  score: 'MORNO',
  canalOrigem: 'WHATSAPP',
  atendenteNome: conv.atendente_nome,
  ultimaMensagem: conv.last_message || '',
  ultimaMensagemEm: conv.last_message_at || conv.created_at,
  naoLidas: conv.unread_count || 0,
});

const mapMessageToMensagem = (msg: any): Mensagem => ({
  _id: msg.id,
  origem: msg.origin as any,
  conteudo: msg.content,
  atendenteNome: msg.sender_name || undefined,
  criadoEm: msg.created_at,
});

let cancelRealtime: (() => void) | null = null;

export const useConversaStore = create<ConversaStore>((set, get) => ({
  leads: [],
  leadSelecionado: null,
  mensagens: [],
  filtroStatus: 'ABERTAS',
  filtroSidebar: 'todas',
  busca: '',
  digitando: false,
  carregandoLeads: false,
  carregandoMensagens: false,

  setLeadSelecionado: (lead) => {
    set({ leadSelecionado: lead });
    if (lead) {
      get().carregarMensagens(lead._id);
      get().marcarLida(lead._id);
    } else {
      set({ mensagens: [] });
    }
  },

  setFiltroStatus: (status) => set({ filtroStatus: status }),
  setFiltroSidebar: (filtro) => set({ filtroSidebar: filtro }),
  setBusca: (busca) => set({ busca }),

  carregarLeads: async () => {
    set({ carregandoLeads: true });
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });
      
      if (error) throw error;
      
      let resLeads = (data || []).map(mapConversationToLead);

      // MOCk Data - Falls back to mock if no conversations are present in database
      // so you can test mock setups and Meta API emulation
      if (resLeads.length === 0) {
        resLeads = [...MOCK_LEADS];
      }

      set({ leads: resLeads });
    } catch (err) {
      console.error('Erro ao carregar conversas:', err);
    } finally {
      set({ carregandoLeads: false });
    }
  },

  carregarMensagens: async (leadId: string) => {
    set({ carregandoMensagens: true });
    try {
      // Mock Data Bypass
      if (MOCK_LEADS.find(l => l._id === leadId)) {
        set({ mensagens: MOCK_MENSAGENS[leadId] ? [...MOCK_MENSAGENS[leadId]] : [] });
        return;
      }

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', leadId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      
      set({ mensagens: (data || []).map(mapMessageToMensagem) });
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    } finally {
      set({ carregandoMensagens: false });
    }
  },

  marcarLida: async (leadId) => {
    set((state) => ({
      leads: state.leads.map((l) => l._id === leadId ? { ...l, naoLidas: 0 } : l),
    }));

    if (MOCK_LEADS.find(l => l._id === leadId)) return; // Don't call backend if mock

    try {
      await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', leadId);
    } catch (err) {
      console.error('Erro ao marcar como lida:', err);
    }
  },

  enviarMensagem: async (conteudo, tipo, atendenteNome) => {
    const lead = get().leadSelecionado;
    if (!lead) return;

    const msgTemporaria: Mensagem = {
      _id: `temp-${Date.now()}`,
      origem: tipo === 'nota' ? 'NOTA_INTERNA' : 'ATENDENTE',
      conteudo,
      atendenteNome,
      criadoEm: new Date().toISOString(),
    };
    
    // Mostra no chat imediatamente
    set((state) => ({ 
      mensagens: [...state.mensagens, msgTemporaria],
      leads: state.leads.map((l) =>
        l._id === lead._id ? { ...l, ultimaMensagem: conteudo, ultimaMensagemEm: new Date().toISOString() } : l
      ),
    }));

    // Mock bypass
    if (MOCK_LEADS.find(l => l._id === lead._id)) {
      if (!MOCK_MENSAGENS[lead._id]) MOCK_MENSAGENS[lead._id] = [];
      MOCK_MENSAGENS[lead._id].push(msgTemporaria);

      // Simulate client response
      if (tipo === 'mensagem') {
        setTimeout(() => set({ digitando: true }), 1500);
        setTimeout(() => {
          const resposta = RESPOSTAS_LEAD_MOCK[Math.floor(Math.random() * RESPOSTAS_LEAD_MOCK.length)];
          const replyMsg: Mensagem = {
            _id: `m-${Date.now()}-reply`,
            origem: 'LEAD',
            conteudo: resposta,
            criadoEm: new Date().toISOString(),
          };
          MOCK_MENSAGENS[lead._id].push(replyMsg);
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
        }, 4000);
      }
      return;
    }

    try {
      if (tipo === 'nota') {
        const { data } = await supabase.from('messages').insert({
          conversation_id: lead._id,
          origin: 'NOTA_INTERNA',
          content: conteudo,
          sender_name: atendenteNome,
        }).select().single();
        
        if (data) {
          set((state) => ({
            mensagens: state.mensagens.map(m => m._id === msgTemporaria._id ? mapMessageToMensagem(data) : m)
          }));
        }
        return;
      }

      const { data: result, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          conversationId: lead._id,
          content: conteudo,
          senderName: atendenteNome,
        }
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      if (result?.message) {
        set((state) => ({
          mensagens: state.mensagens.map(m => m._id === msgTemporaria._id ? mapMessageToMensagem(result.message) : m)
        }));
      }

    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      toast.error('Ocorreu um erro ao enviar a mensagem. Verifique a conexão com a Evolution API.');
    }
  },

  inscreverRealtime: () => {
    if (cancelRealtime) return;

    const channel = supabase.channel('whatsapp-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          const state = get();
          const newMsg = payload.new as any;
          if (payload.eventType === 'INSERT' && newMsg && newMsg.conversation_id === state.leadSelecionado?._id) {
            const exists = state.mensagens.find(m => m.conteudo === newMsg.content && m.origem === newMsg.origin && Math.abs(new Date(m.criadoEm).getTime() - new Date(newMsg.created_at).getTime()) < 5000);
            if (!exists) {
              set({ mensagens: [...state.mensagens, mapMessageToMensagem(newMsg)] });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          const state = get();
          const pNew = payload.new as any;
          if (payload.eventType === 'INSERT') {
            const newLead = mapConversationToLead(pNew);
            set({ leads: [newLead, ...state.leads] });
          } else if (payload.eventType === 'UPDATE') {
            set({
              leads: state.leads.map(l => l._id === pNew.id ? mapConversationToLead(pNew) : l),
              leadSelecionado: state.leadSelecionado?._id === pNew.id ? mapConversationToLead(pNew) : state.leadSelecionado
            });
          }
        }
      )
      .subscribe();

    cancelRealtime = () => {
      supabase.removeChannel(channel);
      cancelRealtime = null;
    };
  },

  redistribuirLead: async (leadId, atendenteNome) => {
    set((state) => ({
      leads: state.leads.map((l) => l._id === leadId ? { ...l, atendenteNome } : l),
      leadSelecionado: state.leadSelecionado?._id === leadId ? { ...state.leadSelecionado, atendenteNome } : state.leadSelecionado,
    }));
    if (!MOCK_LEADS.find(l => l._id === leadId)) {
      await supabase.from('conversations').update({ atendente_nome: atendenteNome }).eq('id', leadId);
    }
  },

  assumirConversa: async (leadId, gestorNome) => {
    set((state) => ({
      leads: state.leads.map((l) => l._id === leadId ? { ...l, atendenteNome: gestorNome } : l),
      leadSelecionado: state.leadSelecionado?._id === leadId ? { ...state.leadSelecionado, atendenteNome: gestorNome } : state.leadSelecionado,
    }));
    if (!MOCK_LEADS.find(l => l._id === leadId)) {
      await supabase.from('conversations').update({ atendente_nome: gestorNome }).eq('id', leadId);
    }
  },

  adicionarLead: (lead) => {
    set((state) => ({ leads: [lead, ...state.leads] }));
  },
}));
