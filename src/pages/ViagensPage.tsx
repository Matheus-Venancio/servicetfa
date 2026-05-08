import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  MapPin, Plus, Loader2, X, Search, DollarSign, CalendarDays, User, ArrowRight
} from 'lucide-react';

// Tipagem estendida para incluir os dados do lead e atendente na viagem
type Viagem = {
  id: string;
  lead_id: string;
  atendente_id: string;
  destino: string;
  data_partida: string;
  data_retorno: string;
  valor_investimento: number;
  status: string;
  criado_em: string;
  lead?: { nome: string; telefone: string };
  atendente?: { nome: string };
};

type Lead = { id: string; nome: string; telefone: string };
type Atendente = { id: string; nome: string };

export default function ViagensPage() {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [atendentes, setAtendentes] = useState<Atendente[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedAtendenteId, setSelectedAtendenteId] = useState<string>('');
  const [destino, setDestino] = useState('');
  const [dataPartida, setDataPartida] = useState('');
  const [dataRetorno, setDataRetorno] = useState('');
  const [valorInvestimento, setValorInvestimento] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [viagensRes, leadsRes, atendentesRes] = await Promise.all([
        supabase.from('viagens').select('*, lead:leads(nome, telefone), atendente:atendentes(nome)').order('data_partida', { ascending: true }),
        supabase.from('leads').select('id, nome, telefone').order('nome', { ascending: true }),
        supabase.from('atendentes').select('id, nome').order('nome', { ascending: true })
      ]);

      if (viagensRes.error) throw viagensRes.error;
      if (leadsRes.error) throw leadsRes.error;
      if (atendentesRes.error) throw atendentesRes.error;

      setViagens(viagensRes.data as unknown as Viagem[]);
      setLeads(leadsRes.data);
      setAtendentes(atendentesRes.data);
    } catch (error: any) {
      toast.error('Erro ao buscar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setSelectedLeadId('');
    setSelectedAtendenteId('');
    setDestino('');
    setDataPartida('');
    setDataRetorno('');
    setValorInvestimento('');
  };

  const handleRegisterViagem = async () => {
    if (!selectedLeadId || !selectedAtendenteId || !destino || !dataPartida || !dataRetorno) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('viagens')
        .insert({
          lead_id: selectedLeadId,
          atendente_id: selectedAtendenteId,
          destino,
          data_partida: dataPartida,
          data_retorno: dataRetorno,
          valor_investimento: valorInvestimento ? Number(valorInvestimento) : 0,
          status: 'AGENDADA'
        });

      if (error) throw new Error(error.message);

      toast.success('Viagem e investimento registrados com sucesso!');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error('Erro ao registrar viagem:', err);
      toast.error('Erro: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const calcularFaturamentoTotal = () => {
    return viagens.reduce((acc, v) => acc + (v.valor_investimento || 0), 0);
  };

  return (
    <div className="h-full overflow-y-auto p-6 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Viagens e Investimentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle o faturamento e as viagens dos clientes</p>
        </div>
        <div className="flex gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="text" placeholder="Buscar viagens..." className="pl-9 bg-background" />
          </div>
          <Button onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Cadastrar Viagem
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">
                  R$ {calcularFaturamentoTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">Faturamento Total</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">{viagens.length}</p>
                <p className="text-xs text-muted-foreground">Viagens Registradas</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {viagens.filter(v => new Date(v.data_partida) > new Date()).length}
                </p>
                <p className="text-xs text-muted-foreground">Viagens Futuras</p>
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">Cliente</th>
                    <th className="px-6 py-4 font-medium">Destino</th>
                    <th className="px-6 py-4 font-medium">Datas</th>
                    <th className="px-6 py-4 font-medium">Atendente</th>
                    <th className="px-6 py-4 font-medium">Investimento</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {viagens.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                        Nenhuma viagem cadastrada ainda.
                      </td>
                    </tr>
                  ) : (
                    viagens.map((v) => (
                      <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{v.lead?.nome || 'Desconhecido'}</div>
                          <div className="text-xs text-muted-foreground">{v.lead?.telefone}</div>
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {v.destino}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground text-xs">
                          <div className="flex items-center gap-1">
                            {new Date(v.data_partida).toLocaleDateString('pt-BR')} 
                            <ArrowRight className="h-3 w-3" />
                            {new Date(v.data_retorno).toLocaleDateString('pt-BR')}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>{v.atendente?.nome || 'Não atribuído'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-medium text-green-600">
                          R$ {Number(v.valor_investimento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            v.status === 'AGENDADA' ? 'bg-blue-500/10 text-blue-500' :
                            v.status === 'CONCLUIDA' ? 'bg-green-500/10 text-green-600' :
                            'bg-red-500/10 text-red-500'
                          }`}>
                            {v.status}
                          </span>
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

      {/* Modal Novo Registro */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <Card className="max-w-xl w-full flex flex-col relative shadow-2xl overflow-hidden max-h-[90vh]">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold">Cadastrar Viagem</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Registre o faturamento e os dados da viagem do cliente
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1 md:col-span-2">
                  <Label>Cliente *</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                  >
                    <option value="">Selecione um cliente...</option>
                    {leads.map(l => <option key={l.id} value={l.id}>{l.nome} ({l.telefone})</option>)}
                  </select>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <Label>Atendente Responsável *</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedAtendenteId}
                    onChange={(e) => setSelectedAtendenteId(e.target.value)}
                  >
                    <option value="">Selecione o atendente...</option>
                    {atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <Label>Destino *</Label>
                  <Input 
                    placeholder="Ex: Paris, França" 
                    value={destino} 
                    onChange={e => setDestino(e.target.value)} 
                  />
                </div>

                <div>
                  <Label>Data de Partida *</Label>
                  <Input 
                    type="date" 
                    value={dataPartida} 
                    onChange={e => setDataPartida(e.target.value)} 
                  />
                </div>

                <div>
                  <Label>Data de Retorno *</Label>
                  <Input 
                    type="date" 
                    value={dataRetorno} 
                    onChange={e => setDataRetorno(e.target.value)} 
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <Label>Valor do Investimento (R$) *</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={valorInvestimento} 
                    onChange={e => setValorInvestimento(e.target.value)} 
                  />
                </div>
              </div>

            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end shrink-0 bg-muted/20 gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button disabled={submitting} onClick={handleRegisterViagem}>
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar Viagem'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
