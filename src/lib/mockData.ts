export interface Lead {
  _id: string;
  nome: string;
  telefone: string;
  email?: string;
  status: 'NOVO' | 'QUALIFICANDO' | 'EM_ATENDIMENTO' | 'PROPOSTA_ENVIADA' | 'FECHADO' | 'PERDIDO';
  score: 'QUENTE' | 'MORNO' | 'FRIO';
  canalOrigem: string;
  destino?: string;
  dataPartida?: string;
  dataRetorno?: string;
  numeroPessoas?: number;
  orcamento?: number;
  campanha?: string;
  atendenteNome: string | null;
  ultimaMensagem: string;
  ultimaMensagemEm: string;
  naoLidas: number;
}

export interface Mensagem {
  _id: string;
  origem: 'LEAD' | 'ATENDENTE' | 'BOT' | 'NOTA_INTERNA';
  conteudo: string;
  atendenteNome?: string;
  criadoEm: string;
}

export interface Atendente {
  _id: string;
  nome: string;
  email: string;
  papel: 'ATENDENTE' | 'GESTOR';
  status: 'ONLINE' | 'OCUPADO' | 'OFFLINE';
  maxLeads: number;
  leadsAtivos: number;
  conversoes: number;
}

export const MOCK_USERS = [
  { email: 'gestor@tfa.com', senha: '123456', papel: 'GESTOR' as const, nome: 'Carlos Gestor', id: 'u1' },
  { email: 'ana@tfa.com', senha: '123456', papel: 'ATENDENTE' as const, nome: 'Ana Costa', id: 'u2' },
  { email: 'marcos@tfa.com', senha: '123456', papel: 'ATENDENTE' as const, nome: 'Marcos Silva', id: 'u3' },
];

export const MOCK_LEADS: Lead[] = [
  {
    _id: '1', nome: 'Fernanda Lima', telefone: '+5511999990010', status: 'EM_ATENDIMENTO', score: 'QUENTE',
    canalOrigem: 'META_ADS', destino: 'Cancún, México', dataPartida: '2025-07-10', dataRetorno: '2025-07-20',
    numeroPessoas: 2, orcamento: 12000, campanha: 'Verão 2025', atendenteNome: 'Ana Costa',
    ultimaMensagem: 'O que a Sra achou?', ultimaMensagemEm: new Date(Date.now() - 4 * 3600000).toISOString(), naoLidas: 0,
  },
  {
    _id: '2', nome: 'Joci Ramos', telefone: '+5511999990020', status: 'NOVO', score: 'MORNO',
    canalOrigem: 'META_ADS', atendenteNome: null, ultimaMensagem: 'Olá',
    ultimaMensagemEm: new Date(Date.now() - 2 * 3600000).toISOString(), naoLidas: 1,
  },
  {
    _id: '3', nome: 'Alexandre Moreira', telefone: '+5511999990030', status: 'QUALIFICANDO', score: 'MORNO',
    canalOrigem: 'META_ADS', atendenteNome: 'SAC TFA Viagens',
    ultimaMensagem: 'Olá! Tenho interesse e qu...', ultimaMensagemEm: new Date(Date.now() - 2 * 3600000).toISOString(), naoLidas: 3,
  },
  {
    _id: '4', nome: 'Jelcimara Cavalcante', telefone: '+5511999990040', status: 'EM_ATENDIMENTO', score: 'QUENTE',
    canalOrigem: 'META_ADS', destino: 'Paris, França', numeroPessoas: 4, orcamento: 28000, atendenteNome: 'Marcos Silva',
    ultimaMensagem: 'Olá! Tenho interesse e qu...', ultimaMensagemEm: new Date(Date.now() - 3 * 3600000).toISOString(), naoLidas: 1,
  },
  {
    _id: '5', nome: 'Patricia Souza', telefone: '+5511999990050', status: 'PROPOSTA_ENVIADA', score: 'QUENTE',
    canalOrigem: 'META_ADS', destino: 'Orlando, EUA', numeroPessoas: 3, orcamento: 20000, atendenteNome: 'Marcos Silva',
    ultimaMensagem: 'Aprovando vejo o seguro viag', ultimaMensagemEm: new Date(Date.now() - 4 * 3600000).toISOString(), naoLidas: 0,
  },
  {
    _id: '6', nome: 'Elida', telefone: '+5511999990060', status: 'EM_ATENDIMENTO', score: 'QUENTE',
    canalOrigem: 'META_ADS', destino: 'Lisboa, Portugal', numeroPessoas: 1, atendenteNome: 'Rafael Santana',
    ultimaMensagem: 'O que a Sra achou?', ultimaMensagemEm: new Date(Date.now() - 4 * 3600000).toISOString(), naoLidas: 0,
  },
];

export const MOCK_MENSAGENS: Record<string, Mensagem[]> = {
  '6': [
    { _id: 'm1', origem: 'LEAD', conteudo: 'Bom dia\nAeroporto de Lisboa\nEu queria assim bem em conta me faltam que eu viajando no dia do natal e mais em conta então queria saber dia 24 ou dia 25 de dezembro\nPara 1 pessoa\nDestino São Paulo', criadoEm: '2026-03-21T05:48:00Z' },
    { _id: 'm2', origem: 'ATENDENTE', conteudo: 'Olá poderiamos dar continuidade a sua cotação?', atendenteNome: 'Rafael Santana', criadoEm: '2026-03-22T16:54:00Z' },
    { _id: 'm3', origem: 'LEAD', conteudo: 'Olá poderia sim por favor', criadoEm: '2026-03-23T11:23:00Z' },
    { _id: 'm4', origem: 'ATENDENTE', conteudo: 'Olá Elida, tudo bem com você!?\nBoa tarde!', atendenteNome: 'Rafael Santana', criadoEm: '2026-03-23T14:48:00Z' },
    { _id: 'm5', origem: 'ATENDENTE', conteudo: 'Muito prazer!\nSou Rafael, consultor na agência TFA Viagens e irei prosseguir em seu atendimento.', atendenteNome: 'Rafael Santana', criadoEm: '2026-03-23T14:49:00Z' },
  ],
  '1': [
    { _id: 'm10', origem: 'LEAD', conteudo: 'Oi, vi o anúncio de Cancún e fiquei interessada!', criadoEm: new Date(Date.now() - 7200000).toISOString() },
    { _id: 'm11', origem: 'BOT', conteudo: 'Olá! Que ótimo! Para quantas pessoas seria a viagem?', criadoEm: new Date(Date.now() - 7100000).toISOString() },
    { _id: 'm12', origem: 'LEAD', conteudo: 'Para 2 pessoas, eu e meu marido.', criadoEm: new Date(Date.now() - 7000000).toISOString() },
    { _id: 'm13', origem: 'ATENDENTE', conteudo: 'Oi Fernanda! Sou a Ana. Que período vocês têm em mente para Cancún?', atendenteNome: 'Ana Costa', criadoEm: new Date(Date.now() - 6000000).toISOString() },
    { _id: 'm14', origem: 'LEAD', conteudo: 'Queremos ir de 10 a 20 de julho. Orçamento de até R$12.000.', criadoEm: new Date(Date.now() - 5000000).toISOString() },
    { _id: 'm15', origem: 'ATENDENTE', conteudo: 'Perfeito! Vou montar uma proposta incrível para vocês. Me dá alguns minutos 😊', atendenteNome: 'Ana Costa', criadoEm: new Date(Date.now() - 4000000).toISOString() },
  ],
  '2': [
    { _id: 'm20', origem: 'LEAD', conteudo: 'Olá', criadoEm: new Date(Date.now() - 2 * 3600000).toISOString() },
  ],
  '3': [
    { _id: 'm30', origem: 'LEAD', conteudo: 'Olá! Tenho interesse e quero saber mais sobre pacotes.', criadoEm: new Date(Date.now() - 3 * 3600000).toISOString() },
    { _id: 'm31', origem: 'BOT', conteudo: 'Olá! Bem-vindo à TFA Viagens! Qual destino te interessa?', criadoEm: new Date(Date.now() - 2.9 * 3600000).toISOString() },
    { _id: 'm32', origem: 'LEAD', conteudo: 'Gostaria de ver opções para o Caribe.', criadoEm: new Date(Date.now() - 2 * 3600000).toISOString() },
  ],
  '4': [
    { _id: 'm40', origem: 'LEAD', conteudo: 'Olá! Tenho interesse e quero saber sobre Paris.', criadoEm: new Date(Date.now() - 4 * 3600000).toISOString() },
    { _id: 'm41', origem: 'ATENDENTE', conteudo: 'Oi Jelcimara! Sou o Marcos. Paris é maravilhosa! Para quantas pessoas?', atendenteNome: 'Marcos Silva', criadoEm: new Date(Date.now() - 3.5 * 3600000).toISOString() },
    { _id: 'm42', origem: 'LEAD', conteudo: '4 pessoas, família toda!', criadoEm: new Date(Date.now() - 3 * 3600000).toISOString() },
  ],
  '5': [
    { _id: 'm50', origem: 'LEAD', conteudo: 'Vi o pacote de Orlando, ainda tem disponibilidade?', criadoEm: new Date(Date.now() - 5 * 3600000).toISOString() },
    { _id: 'm51', origem: 'ATENDENTE', conteudo: 'Sim! Temos ótimas opções. Enviei a proposta por email.', atendenteNome: 'Marcos Silva', criadoEm: new Date(Date.now() - 4.5 * 3600000).toISOString() },
    { _id: 'm52', origem: 'LEAD', conteudo: 'Aprovando vejo o seguro viagem também.', criadoEm: new Date(Date.now() - 4 * 3600000).toISOString() },
  ],
};

export const MOCK_ATENDENTES: Atendente[] = [
  { _id: 'a1', nome: 'Ana Costa', email: 'ana@tfa.com', papel: 'ATENDENTE', status: 'ONLINE', maxLeads: 15, leadsAtivos: 14, conversoes: 8 },
  { _id: 'a2', nome: 'Marcos Silva', email: 'marcos@tfa.com', papel: 'ATENDENTE', status: 'ONLINE', maxLeads: 15, leadsAtivos: 12, conversoes: 4 },
  { _id: 'a3', nome: 'Rafael Santana', email: 'rafael@tfa.com', papel: 'ATENDENTE', status: 'OCUPADO', maxLeads: 15, leadsAtivos: 15, conversoes: 6 },
  { _id: 'a4', nome: 'Carlos Gestor', email: 'gestor@tfa.com', papel: 'GESTOR', status: 'ONLINE', maxLeads: 999, leadsAtivos: 0, conversoes: 0 },
];

export const MOCK_METRICAS = {
  leadsHoje: 87,
  leadsEmAtendimento: 30,
  leadsFechados: 12,
  taxaConversao: 13.7,
  naoAtribuidas: 51,
  tempoMedioResposta: { horas: 12, minutos: 26, segundos: 53 },
  leadsPorScore: { quente: 22, morno: 35, frio: 30 },
  evolucaoSemanal: [
    { dia: 'Seg', leads: 52, conversoes: 7 },
    { dia: 'Ter', leads: 68, conversoes: 9 },
    { dia: 'Qua', leads: 45, conversoes: 6 },
    { dia: 'Qui', leads: 71, conversoes: 11 },
    { dia: 'Sex', leads: 90, conversoes: 14 },
    { dia: 'Sáb', leads: 38, conversoes: 5 },
    { dia: 'Dom', leads: 87, conversoes: 12 },
  ],
};

export const RESPOSTAS_LEAD_MOCK = [
  'Ok, vou pensar e retorno!',
  'Que interessante, pode me mandar mais detalhes?',
  'Quanto tempo demora o voo?',
  'Tem opção de parcelamento?',
  'Meu marido também quer ir, seria possível?',
  'Vocês incluem seguro viagem?',
  'Qual hotel vocês recomendam?',
  'Perfeito, vamos fechar!',
];
