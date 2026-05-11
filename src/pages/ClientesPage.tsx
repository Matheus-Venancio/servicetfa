import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Lead, LeadStatus, LeadScore, CanalOrigem } from '@/integrations/supabase/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Plus, Users, Loader2, X, Search, Filter, MessageCircle, Calendar, MapPin, DollarSign, Edit, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type LeadWithViagens = Lead & { viagens?: any[] };

export default function ClientesPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadWithViagens[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  // Form states
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<LeadStatus>('NOVO');
  const [score, setScore] = useState<LeadScore>('FRIO');
  const [canalOrigem, setCanalOrigem] = useState<CanalOrigem>('META_ADS');
  const [destino, setDestino] = useState('');
  const [dataPartida, setDataPartida] = useState('');
  const [dataRetorno, setDataRetorno] = useState('');
  const [numeroPessoas, setNumeroPessoas] = useState<number>(1);
  const [orcamento, setOrcamento] = useState<number | ''>('');
  const [observacoes, setObservacoes] = useState('');

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*, viagens(*)')
      .order('criado_em', { ascending: false });

    if (!error && data) {
      setLeads(data as unknown as LeadWithViagens[]);
    } else if (error) {
      toast.error('Erro ao buscar clientes: ' + error.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const resetForm = () => {
    setNome('');
    setTelefone('');
    setEmail('');
    setStatus('NOVO');
    setScore('FRIO');
    setCanalOrigem('META_ADS');
    setDestino('');
    setDataPartida('');
    setDataRetorno('');
    setNumeroPessoas(1);
    setOrcamento('');
    setObservacoes('');
    setEditingLeadId(null);
  };

  const openEditModal = (lead: Lead) => {
    setNome(lead.nome || '');
    setTelefone(lead.telefone);
    setEmail(lead.email || '');
    setStatus(lead.status);
    setScore(lead.score);
    setCanalOrigem(lead.canal_origem);
    setDestino(lead.destino || '');
    setDataPartida(lead.data_partida || '');
    setDataRetorno(lead.data_retorno || '');
    setNumeroPessoas(lead.numero_pessoas || 1);
    setOrcamento(lead.orcamento || '');
    setObservacoes(lead.observacoes || '');
    setEditingLeadId(lead.id);
    setShowModal(true);
  };

  const handleSaveLead = async () => {
    if (!telefone.trim()) {
      toast.error('O telefone é obrigatório');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        nome: nome || null,
        telefone,
        email: email || null,
        status,
        score,
        canal_origem: canalOrigem,
        destino: destino || null,
        data_partida: dataPartida || null,
        data_retorno: dataRetorno || null,
        numero_pessoas: numeroPessoas || null,
        orcamento: orcamento ? Number(orcamento) : null,
        observacoes: observacoes || null,
      };

      if (editingLeadId) {
        const { error } = await supabase
          .from('leads')
          .update(payload)
          .eq('id', editingLeadId);

        if (error) throw new Error(error.message);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('leads')
          .insert(payload);

        if (error) throw new Error(error.message);
        toast.success('Cliente cadastrado com sucesso!');
      }

      setShowModal(false);
      resetForm();
      await fetchLeads();
    } catch (err: any) {
      console.error('Erro ao salvar lead:', err);
      toast.error('Erro ao salvar: ' + (err?.message ?? 'erro desconhecido'));
    }

    setSubmitting(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NOVO': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'QUALIFICANDO': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'AGUARDANDO': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'EM_ATENDIMENTO': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'PROPOSTA_ENVIADA': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      case 'FECHADO': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'PERDIDO': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getScoreBadge = (score: string) => {
    switch (score) {
      case 'QUENTE': return '🔥 Quente';
      case 'MORNO': return '☀️ Morno';
      case 'FRIO': return '❄️ Frio';
      default: return score;
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie e cadastre seus leads e clientes</p>
        </div>
        <div className="flex gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="text" placeholder="Buscar clientes..." className="pl-9 bg-background" />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
          <Button onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo Cliente
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">{leads.length}</p>
                <p className="text-xs text-muted-foreground">Total de Clientes</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Plus className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {leads.filter((l) => l.status === 'NOVO').length}
                </p>
                <p className="text-xs text-muted-foreground">Novos Leads</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {leads.filter((l) => l.status === 'EM_ATENDIMENTO').length}
                </p>
                <p className="text-xs text-muted-foreground">Em Atendimento</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {leads.filter((l) => l.status === 'FECHADO').length}
                </p>
                <p className="text-xs text-muted-foreground">Fechados</p>
              </div>
            </Card>
          </div>

          {/* Table / List */}
          <Card className="overflow-hidden border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">Cliente</th>
                    <th className="px-6 py-4 font-medium">Contato</th>
                    <th className="px-6 py-4 font-medium">Destino</th>
                    <th className="px-6 py-4 font-medium">Histórico de Viagens</th>
                    <th className="px-6 py-4 font-medium">Status & Score</th>
                    <th className="px-6 py-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                        Nenhum cliente cadastrado.
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{lead.nome || 'Sem Nome'}</div>
                          <div className="text-xs text-muted-foreground">Origem: {lead.canal_origem.replace('_', ' ')}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-foreground">{lead.telefone}</div>
                          {lead.email && <div className="text-xs text-muted-foreground">{lead.email}</div>}
                        </td>
                        <td className="px-6 py-4">
                          {lead.destino ? (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span>{lead.destino}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Não definido</span>
                          )}
                          {(lead.data_partida || lead.numero_pessoas) && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              {lead.data_partida && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(lead.data_partida).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                              {lead.numero_pessoas && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {lead.numero_pessoas} pax
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 w-48">
                            <span className="text-sm font-bold text-green-600">
                              Investimento Total: R$ {lead.viagens?.reduce((acc, v) => acc + (v.valor_investimento || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                            </span>
                            {lead.viagens && lead.viagens.length > 0 ? (
                              <div className="mt-1 max-h-[80px] overflow-y-auto custom-scrollbar border border-border rounded-md p-1 bg-muted/20">
                                {lead.viagens.map(v => (
                                  <div 
                                    key={v.id} 
                                    onClick={() => navigate('/gestor/viagens')}
                                    className="flex items-center justify-between p-1.5 hover:bg-muted rounded cursor-pointer text-xs group transition-colors"
                                    title="Ver Viagens"
                                  >
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                      <MapPin className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0" />
                                      <span className="truncate">{v.destino}</span>
                                    </div>
                                    <span className="font-semibold text-muted-foreground shrink-0 ml-2">
                                      {new Date(v.data_partida).toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic mt-1">Nenhuma viagem</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2 items-start">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border ${getStatusColor(lead.status)}`}>
                              {lead.status.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-medium">
                              {getScoreBadge(lead.score)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditModal(lead)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Modal de Cadastro */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <Card className="max-w-2xl w-full max-h-[90vh] flex flex-col relative shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold">{editingLeadId ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
              {/* Informações Básicas */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary uppercase tracking-wider">Informações Básicas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome</Label>
                    <Input placeholder="Nome do cliente" value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>
                  <div>
                    <Label>Telefone (WhatsApp) *</Label>
                    <Input placeholder="5511999999999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="cliente@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Status e Origem */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary uppercase tracking-wider">Classificação</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Status</Label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as LeadStatus)}
                    >
                      <option value="NOVO">Novo</option>
                      <option value="QUALIFICANDO">Qualificando</option>
                      <option value="AGUARDANDO">Aguardando</option>
                      <option value="EM_ATENDIMENTO">Em Atendimento</option>
                      <option value="PROPOSTA_ENVIADA">Proposta Enviada</option>
                      <option value="FECHADO">Fechado</option>
                      <option value="PERDIDO">Perdido</option>
                      <option value="NURTURING">Nurturing</option>
                    </select>
                  </div>
                  <div>
                    <Label>Temperatura (Score)</Label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={score}
                      onChange={(e) => setScore(e.target.value as LeadScore)}
                    >
                      <option value="FRIO">Frio</option>
                      <option value="MORNO">Morno</option>
                      <option value="QUENTE">Quente</option>
                    </select>
                  </div>
                  <div>
                    <Label>Canal de Origem</Label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={canalOrigem}
                      onChange={(e) => setCanalOrigem(e.target.value as CanalOrigem)}
                    >
                      <option value="META_ADS">Meta Ads</option>
                      <option value="GOOGLE_ADS">Google Ads</option>
                      <option value="TIKTOK_ADS">TikTok Ads</option>
                      <option value="ORGANICO">Orgânico</option>
                      <option value="INDICACAO">Indicação</option>
                      <option value="OUTRO">Outro</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Informações da Viagem */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary uppercase tracking-wider">Dados da Viagem</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Destino</Label>
                    <Input placeholder="Ex: Paris, França" value={destino} onChange={(e) => setDestino(e.target.value)} />
                  </div>
                  <div>
                    <Label>Data de Partida</Label>
                    <Input type="date" value={dataPartida} onChange={(e) => setDataPartida(e.target.value)} />
                  </div>
                  <div>
                    <Label>Data de Retorno</Label>
                    <Input type="date" value={dataRetorno} onChange={(e) => setDataRetorno(e.target.value)} />
                  </div>
                  <div>
                    <Label>Número de Pessoas</Label>
                    <Input type="number" min={1} value={numeroPessoas} onChange={(e) => setNumeroPessoas(parseInt(e.target.value) || 1)} />
                  </div>
                  <div>
                    <Label>Orçamento Previsto (R$)</Label>
                    <Input type="number" placeholder="0.00" value={orcamento} onChange={(e) => setOrcamento(e.target.value ? Number(e.target.value) : '')} />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary uppercase tracking-wider">Observações</h4>
                <div>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Informações adicionais importantes sobre o cliente..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0 bg-muted/20">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button disabled={submitting} onClick={handleSaveLead}>
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : (editingLeadId ? 'Salvar Alterações' : 'Salvar Cliente')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
