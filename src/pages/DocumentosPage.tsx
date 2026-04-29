import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Lead, Contrato } from '@/integrations/supabase/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  FileText, Plus, Loader2, X, Search, ChevronRight, Check, MapPin, Calendar, Users, Briefcase, Download, Mail, DollarSign, CheckCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';

// Tipagem estendida para incluir os dados do lead no contrato (join)
type ContratoComLead = Contrato & { lead?: Lead };

export default function DocumentosPage() {
  const [contratos, setContratos] = useState<ContratoComLead[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [tipo, setTipo] = useState<'NACIONAL' | 'INTERNACIONAL'>('NACIONAL');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  
  // Extra fields for contract generation that might not be in leads table
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [endereco, setEndereco] = useState('');
  const [valorFinal, setValorFinal] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');

  // Auto-filled from lead but editable
  const [destino, setDestino] = useState('');
  const [dataPartida, setDataPartida] = useState('');
  const [dataRetorno, setDataRetorno] = useState('');

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [contratosRes, leadsRes] = await Promise.all([
        supabase.from('contratos').select('*, lead:leads(*)').order('criado_em', { ascending: false }),
        supabase.from('leads').select('*').order('nome', { ascending: true })
      ]);

      if (contratosRes.error) throw contratosRes.error;
      if (leadsRes.error) throw leadsRes.error;

      // Type casting needed due to the foreign key join not being strongly typed in the default config
      setContratos(contratosRes.data as unknown as ContratoComLead[]);
      setLeads(leadsRes.data);
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
    setStep(1);
    setTipo('NACIONAL');
    setSelectedLeadId('');
    setCpf('');
    setRg('');
    setEndereco('');
    setValorFinal('');
    setFormaPagamento('');
    setDestino('');
    setDataPartida('');
    setDataRetorno('');
  };

  const handleNextStep = () => {
    if (step === 2) {
      if (!selectedLeadId) {
        toast.error('Selecione um cliente para continuar');
        return;
      }
      // Pre-fill
      if (selectedLead) {
        setDestino(selectedLead.destino || '');
        setDataPartida(selectedLead.data_partida || '');
        setDataRetorno(selectedLead.data_retorno || '');
        setValorFinal(selectedLead.orcamento ? String(selectedLead.orcamento) : '');
      }
    }
    setStep(s => s + 1);
  };

  const handleGenerateContract = async () => {
    if (!selectedLead) return;

    setSubmitting(true);

    const templateNacional = `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE VIAGEM NACIONAL

CONTRATADA: TFA Viagens
CONTRATANTE: ${selectedLead.nome || '_______________'}, CPF: ${cpf || '_______________'}, RG: ${rg || '_______________'}
Residente em: ${endereco || '_______________'}
Contato: ${selectedLead.telefone} / ${selectedLead.email || '_______________'}

1. DO OBJETO
O presente contrato tem como objeto a prestação de serviços de agenciamento de viagem para o destino: ${destino || '_______________'}.
Período da Viagem: ${dataPartida || '___/___/____'} a ${dataRetorno || '___/___/____'}.
Número de Passageiros: ${selectedLead.numero_pessoas || '1'}.

2. DO VALOR E FORMA DE PAGAMENTO
O valor total dos serviços é de R$ ${valorFinal || '_______________'}.
Forma de Pagamento: ${formaPagamento || '_______________'}.

Local e Data: _______________, ___ de _________ de 20__.

_____________________________________________________
Assinatura do Contratante
    `.trim();

    const templateInternacional = `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE VIAGEM INTERNACIONAL

CONTRATADA: TFA Viagens
CONTRATANTE: ${selectedLead.nome || '_______________'}, Passaporte/CPF: ${cpf || '_______________'}
Residente em: ${endereco || '_______________'}
Contato: ${selectedLead.telefone} / ${selectedLead.email || '_______________'}

1. DO OBJETO
Prestação de serviços de viagem internacional para: ${destino || '_______________'}.
Período: ${dataPartida || '___/___/____'} a ${dataRetorno || '___/___/____'}.
Passageiros: ${selectedLead.numero_pessoas || '1'}.

2. OBRIGAÇÕES (DOCUMENTAÇÃO)
O Contratante é integralmente responsável por providenciar passaporte válido, vistos e vacinas exigidas pelo país de destino.

3. DO VALOR E FORMA DE PAGAMENTO
Valor total: R$ ${valorFinal || '_______________'}.
Forma de Pagamento: ${formaPagamento || '_______________'}.

Local e Data: _______________, ___ de _________ de 20__.

_____________________________________________________
Assinatura do Contratante
    `.trim();

    const conteudo = tipo === 'NACIONAL' ? templateNacional : templateInternacional;

    try {
      const { error } = await supabase
        .from('contratos')
        .insert({
          lead_id: selectedLeadId,
          tipo,
          status: 'GERADO',
          conteudo,
          valor: valorFinal ? Number(valorFinal) : 0
        });

      if (error) throw new Error(error.message);

      toast.success('Contrato gerado com sucesso!');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error('Erro ao gerar contrato:', err);
      toast.error('Erro: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = (contrato: ContratoComLead) => {
    const doc = new jsPDF();
    doc.setFontSize(12);
    const splitText = doc.splitTextToSize(contrato.conteudo || '', 180);
    doc.text(splitText, 15, 20);
    doc.save(`contrato-${contrato.lead?.nome?.replace(/\s+/g, '-') || 'cliente'}.pdf`);
  };

  const handleSendEmail = async (contrato: ContratoComLead) => {
    if (!contrato.lead?.email) {
      toast.error('Este cliente não possui e-mail cadastrado.');
      return;
    }

    try {
      toast.loading('Enviando e-mail pelo sistema...');
      
      const { data, error } = await supabase.functions.invoke('send-contract-email', {
        body: {
          email: contrato.lead.email,
          nome: contrato.lead.nome,
          token: contrato.token_assinatura,
          tipo: contrato.tipo
        }
      });

      if (error) throw new Error(error.message);

      // Atualiza o status para enviado
      if (contrato.status === 'GERADO') {
        await supabase.from('contratos').update({ status: 'ENVIADO' }).eq('id', contrato.id);
        fetchData();
      }

      toast.dismiss();
      toast.success('E-mail com link de assinatura enviado com sucesso!');
    } catch (err: any) {
      toast.dismiss();
      console.error(err);
      toast.error('Falha ao enviar e-mail: Verifique se a Edge Function e o Resend estão configurados no Supabase.');
    }
  };

  const handleFaturar = async (contrato: ContratoComLead) => {
    if (contrato.status !== 'ASSINADO') {
      toast.error('Apenas contratos com status ASSINADO podem ser faturados.');
      return;
    }

    try {
      // 1. Atualizar status do contrato
      const { error: errContrato } = await supabase
        .from('contratos')
        .update({ status: 'FATURADO' })
        .eq('id', contrato.id);
      
      if (errContrato) throw errContrato;

      // 2. Somar no total_gasto do lead
      const novoTotal = (contrato.lead?.total_gasto || 0) + (contrato.valor || 0);
      const { error: errLead } = await supabase
        .from('leads')
        .update({ total_gasto: novoTotal })
        .eq('id', contrato.lead_id);
      
      if (errLead) throw errLead;

      toast.success('Contrato faturado com sucesso! Valor somado ao cliente.');
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao faturar contrato: ' + err.message);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos e Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gere e gerencie contratos para seus clientes</p>
        </div>
        <div className="flex gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="text" placeholder="Buscar documentos..." className="pl-9 bg-background" />
          </div>
          <Button onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo Documento
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">{contratos.length}</p>
                <p className="text-xs text-muted-foreground">Documentos Gerados</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {contratos.filter(c => c.tipo === 'NACIONAL').length}
                </p>
                <p className="text-xs text-muted-foreground">Contratos Nacionais</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {contratos.filter(c => c.tipo === 'INTERNACIONAL').length}
                </p>
                <p className="text-xs text-muted-foreground">Contratos Internacionais</p>
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">Cliente</th>
                    <th className="px-6 py-4 font-medium">Tipo</th>
                    <th className="px-6 py-4 font-medium">Data de Criação</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contratos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                        Nenhum documento gerado ainda.
                      </td>
                    </tr>
                  ) : (
                    contratos.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{c.lead?.nome || 'Desconhecido'}</div>
                          <div className="text-xs text-muted-foreground">{c.lead?.telefone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${c.tipo === 'NACIONAL' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                            {c.tipo}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(c.criado_em).toLocaleDateString('pt-BR')} às {new Date(c.criado_em).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded bg-muted/50 text-xs font-medium border border-border">
                            {c.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleDownloadPDF(c)} title="Baixar PDF">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8 text-blue-500" onClick={() => handleSendEmail(c)} title="Enviar E-mail">
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className={`h-8 text-xs ${c.status === 'FATURADO' ? 'text-muted-foreground' : c.status === 'ASSINADO' ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : 'text-gray-400 opacity-50 cursor-not-allowed'}`}
                              onClick={() => handleFaturar(c)} 
                              disabled={c.status !== 'ASSINADO'}
                              title={c.status === 'FATURADO' ? 'Já faturado' : c.status !== 'ASSINADO' ? 'Aguardando assinatura' : 'Faturar'}
                            >
                              {c.status === 'FATURADO' ? <CheckCircle className="h-3 w-3 mr-1" /> : <DollarSign className="h-3 w-3 mr-1" />}
                              {c.status === 'FATURADO' ? 'Faturado' : 'Faturar'}
                            </Button>
                          </div>
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

      {/* Modal Multi-step */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <Card className="max-w-2xl w-full flex flex-col relative shadow-2xl overflow-hidden max-h-[90vh]">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold">Novo Documento</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Passo {step} de 3: {step === 1 ? 'Tipo de Contrato' : step === 2 ? 'Selecionar Cliente' : 'Revisão e Dados'}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              
              {/* STEP 1 */}
              {step === 1 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Escolha o modelo de documento</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <Card 
                      className={`p-6 cursor-pointer hover:border-primary transition-all ${tipo === 'NACIONAL' ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`}
                      onClick={() => setTipo('NACIONAL')}
                    >
                      <MapPin className="h-8 w-8 text-blue-500 mb-4" />
                      <h5 className="font-bold text-lg mb-2">Viagem Nacional</h5>
                      <p className="text-sm text-muted-foreground">Contrato padrão para destinos dentro do Brasil. Requer documentação local.</p>
                    </Card>
                    <Card 
                      className={`p-6 cursor-pointer hover:border-primary transition-all ${tipo === 'INTERNACIONAL' ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`}
                      onClick={() => setTipo('INTERNACIONAL')}
                    >
                      <Briefcase className="h-8 w-8 text-purple-500 mb-4" />
                      <h5 className="font-bold text-lg mb-2">Viagem Internacional</h5>
                      <p className="text-sm text-muted-foreground">Contrato para destinos fora do Brasil. Cláusulas de passaporte e vistos.</p>
                    </Card>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Para quem é este contrato?</h4>
                  <p className="text-sm text-muted-foreground mb-4">Selecione um cliente da sua base de leads.</p>
                  
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nome ou telefone..." className="pl-10" />
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {leads.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente cadastrado.</p>
                    ) : (
                      leads.map(lead => (
                        <div 
                          key={lead.id} 
                          className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${selectedLeadId === lead.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}
                          onClick={() => setSelectedLeadId(lead.id)}
                        >
                          <div>
                            <p className="font-medium text-sm text-foreground">{lead.nome || 'Sem nome'}</p>
                            <p className="text-xs text-muted-foreground">{lead.telefone}</p>
                          </div>
                          {selectedLeadId === lead.id && <Check className="h-5 w-5 text-primary" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <h4 className="text-sm font-semibold text-primary mb-2">Resumo</h4>
                    <p className="text-xs text-muted-foreground">
                      Contrato: <strong className="text-foreground">{tipo}</strong> <br/>
                      Cliente: <strong className="text-foreground">{selectedLead?.nome} ({selectedLead?.telefone})</strong>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider">Completar Dados</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>CPF / Passaporte</Label>
                        <Input placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(e.target.value)} />
                      </div>
                      {tipo === 'NACIONAL' && (
                        <div>
                          <Label>RG</Label>
                          <Input placeholder="00.000.000-0" value={rg} onChange={e => setRg(e.target.value)} />
                        </div>
                      )}
                      <div className={tipo === 'NACIONAL' ? 'md:col-span-2' : ''}>
                        <Label>Endereço Completo</Label>
                        <Input placeholder="Rua, Número, Bairro, Cidade - UF" value={endereco} onChange={e => setEndereco(e.target.value)} />
                      </div>
                      
                      <div className="md:col-span-2 mt-4">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Dados da Viagem</h4>
                      </div>

                      <div>
                        <Label>Destino</Label>
                        <Input value={destino} onChange={e => setDestino(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Ida</Label>
                          <Input type="date" value={dataPartida} onChange={e => setDataPartida(e.target.value)} />
                        </div>
                        <div>
                          <Label>Volta</Label>
                          <Input type="date" value={dataRetorno} onChange={e => setDataRetorno(e.target.value)} />
                        </div>
                      </div>
                      
                      <div>
                        <Label>Valor Total Final (R$)</Label>
                        <Input type="number" placeholder="0.00" value={valorFinal} onChange={e => setValorFinal(e.target.value)} />
                      </div>
                      <div>
                        <Label>Forma de Pagamento</Label>
                        <Input placeholder="Ex: 10x no Cartão" value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} />
                      </div>

                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="px-6 py-4 border-t border-border flex justify-between shrink-0 bg-muted/20">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(s => s - 1)}>Voltar</Button>
              ) : (
                <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              )}
              
              {step < 3 ? (
                <Button onClick={handleNextStep}>Próximo Passo <ChevronRight className="h-4 w-4 ml-1" /></Button>
              ) : (
                <Button disabled={submitting} onClick={handleGenerateContract}>
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</> : 'Gerar Contrato'}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
