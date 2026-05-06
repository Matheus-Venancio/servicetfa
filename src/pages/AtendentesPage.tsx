import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Atendente } from '@/integrations/supabase/types';
import { AvatarInicial } from '@/components/AvatarInicial';
import { StatusDot } from '@/components/StatusDot';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Plus, MessageCircle, Users, ChevronRight, Headphones,
  Loader2, QrCode, X, Smartphone, Power, PowerOff
} from 'lucide-react';

// Tipagem de tela para conter métricas mockadas auxiliares temporárias
type AtendenteTela = Atendente & {
  leadsAtivos: number;
  conversoes: number;
  naoLidas: number;
};

// ─── Helper para processar QR (Idêntico ao connect page) ─────────────────────
function extrairBase64QR(data: any): string | null {
  const raw: string | undefined =
    data?.qrcode?.base64 ?? data?.qrcode?.code ?? data?.base64 ?? data?.qrcode ?? data?.code;
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('data:image')) return raw;
  return `data:image/png;base64,${raw}`;
}

export default function AtendentesPage() {
  const navigate = useNavigate();
  const [atendentes, setAtendentes] = useState<AtendenteTela[]>([]);
  const [loading, setLoading] = useState(true);

  // States do Modal de Criação / QR
  const [showModal, setShowModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

  // Form
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [maxLeads, setMaxLeads] = useState(10);

  const fetchAtendentes = async () => {
    setLoading(true);

    // Busca atendentes e leads em paralelo para métricas reais
    const [atendentesRes, leadsRes] = await Promise.all([
      (supabase
        .from('atendentes')
        .select('*')
        .eq('papel', 'ATENDENTE') as unknown as Promise<{ data: Atendente[] | null; error: any }>),
      supabase
        .from('leads')
        .select('atendente_id, status')
        .not('atendente_id', 'is', null),
    ]);

    if (!atendentesRes.error && atendentesRes.data) {
      const leads = leadsRes.data ?? [];

      const a = atendentesRes.data.map((d: Atendente) => {
        const leadsAtivos = leads.filter(
          (l) => l.atendente_id === d.id && l.status === 'EM_ATENDIMENTO',
        ).length;
        const conversoes = leads.filter(
          (l) => l.atendente_id === d.id && l.status === 'FECHADO',
        ).length;
        return { ...d, leadsAtivos, conversoes, naoLidas: 0 };
      });

      setAtendentes(a);
    }
    setLoading(false);
  };

  // Alterna status do atendente entre ONLINE e OFFLINE
  const handleToggleStatus = async (atendente: AtendenteTela, e: React.MouseEvent) => {
    e.stopPropagation();
    const novoStatus = atendente.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    setTogglingStatus(atendente.id);

    // Atualização otimista — atualiza a UI antes da resposta do Supabase
    setAtendentes((prev) =>
      prev.map((a) => (a.id === atendente.id ? { ...a, status: novoStatus } : a))
    );

    const { error } = await supabase
      .from('atendentes')
      .update({ status: novoStatus } as never)
      .eq('id', atendente.id);

    if (error) {
      // Reverte em caso de erro
      setAtendentes((prev) =>
        prev.map((a) => (a.id === atendente.id ? { ...a, status: atendente.status } : a))
      );
      toast.error('Erro ao atualizar status: ' + error.message);
    } else {
      toast.success(
        novoStatus === 'ONLINE'
          ? `${atendente.nome} ativado com sucesso ✅`
          : `${atendente.nome} pausado com sucesso ⏸️`
      );
    }

    setTogglingStatus(null);
  };

  useEffect(() => {
    fetchAtendentes();
  }, []);

  const handleCreateAtendente = async () => {
    if (!nome.trim() || !email.trim()) {
      toast.error('Preencha pelo menos Nome e Email');
      return;
    }

    setSubmitting(true);
    console.log('Entrou aqui ' + nome, email.trim(), telefone.trim(), maxLeads);
    // AtendentesPage.tsx

    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY; // ✅ era PUBLISHABLE_KEY — chave errada

      const localSupabase = createClient(url, key); // ✅ sem headers manuais — o SDK injeta apikey e Authorization automaticamente

      // 1. Insere o atendente
      const { data: newAtendente, error: dbError } = await localSupabase
        .from('atendentes')
        .insert({
          nome,
          email,
          telefone: telefone || null, // ✅ garante null se vazio, evita string vazia quebrando constraint
          papel: 'ATENDENTE',
          status: 'OFFLINE',
          max_leads: maxLeads,
        })
        .select()
        .single<Atendente>(); // ✅ tipagem direta no .single(), sem cast duplo

      if (dbError) throw new Error(dbError.message);
      if (!newAtendente) throw new Error('Atendente não retornado após inserção');

      console.log('Atendente criado:', newAtendente);

      // 2. Edge function do WhatsApp Connect
      const instanceName = `tfa-${newAtendente.id.slice(0, 8)}`;
      toast.info('Atendente criado. Gerando QR Code...');
const EVOLUTION_URL = 'https://evolution.innovatedigitals.com.br';
const EVOLUTION_TOKEN = 'd3b7573358045479207c1e94adfbf4a3';

const createRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_TOKEN },
  body: JSON.stringify({
    instanceName,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
    ...(telefone ? { number: telefone } : {}),
  }),
});

if (!createRes.ok) {
  const err = await createRes.json().catch(() => ({}));
  throw new Error(err?.message ?? `Evolution create falhou: ${createRes.status}`);
}

// 3. Aguarda inicialização e busca o QR
toast.info('Aguardando QR Code...');
await new Promise(r => setTimeout(r, 3000));

const connectRes = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
  method: 'GET',
  headers: { 'apikey': EVOLUTION_TOKEN },
});

if (!connectRes.ok) {
  const err = await connectRes.json().catch(() => ({}));
  throw new Error(err?.message ?? `Evolution connect falhou: ${connectRes.status}`);
}

const connectData = await connectRes.json();
const base64QR =
  connectData?.base64 ||
  connectData?.qrcode?.base64 ||
  connectData?.qr?.base64 ||
  null;

if (!base64QR) throw new Error('QR Code não retornado pela Evolution');

const qrDataUrl = base64QR.startsWith('data:image') ? base64QR : `data:image/png;base64,${base64QR}`;
setQrCode(qrDataUrl);
toast.success('Escaneie o QR Code para parear o WhatsApp.');

// 4. SÓ AGORA salva no whatsapp_channels
const { data: qrcData, error: evoError } = await supabase.functions.invoke('whatsapp-connect', {
  body: {
    action: 'create_instance',
    instanceName,
    atendenteId: newAtendente.id,
    atendenteNome: newAtendente.nome,
    phoneNumber: newAtendente.telefone,
    status: 'connected',
    evolutionApiUrl: EVOLUTION_URL,
    apiKey: EVOLUTION_TOKEN,
  },
});

      if (evoError) {
        toast.warning('Atendente criado, mas houve falha na geração do QR: ' + evoError.message);
      } else {
        const qrDataUrl = extrairBase64QR(qrcData);
        if (qrDataUrl) {
          setQrCode(qrDataUrl);
          toast.success('Pronto! O atendente já pode ler o QR Code.');
        } else if (qrcData?.error_evolution) {
          toast.warning('Erro da Evolution: ' + qrcData.error_evolution);
        } else {
          toast.warning('Atendente criado, mas nenhum QR retornado.');
        }
      }

      await fetchAtendentes();

    } catch (err: any) {
      console.error('Erro ao cadastrar atendente:', err);
      toast.error('Falha inesperada: ' + (err?.message ?? 'erro desconhecido'));
    }

    setSubmitting(false);

  };

  const EVOLUTION_URL = 'https://evolution.innovatedigitals.com.br';
const EVOLUTION_TOKEN = 'd3b7573358045479207c1e94adfbf4a3';

// Utilitário de espera
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const handleGerarQR = async (atendente: Atendente) => {
  setIsGeneratingQr(atendente.id);
  setNome(atendente.nome);
  toast.info(`Criando instância para ${atendente.nome}...`);

  try {
    const instanceName = `tfa-${atendente.id.slice(0, 8)}`;

    // PASSO 1 — Criar (ou recriar) a instância na Evolution
    const createRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_TOKEN,
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}));

      // Se a instância já existe, tenta deletar e recriar
      if (createRes.status === 409 || errBody?.message?.includes('already')) {
        toast.info('Instância já existe. Reconectando...');

        await fetch(`${EVOLUTION_URL}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: { 'apikey': EVOLUTION_TOKEN },
        });

        await sleep(1500);

        const retryRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_TOKEN,
          },
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        });

        if (!retryRes.ok) {
          const retryErr = await retryRes.json().catch(() => ({}));
          throw new Error(retryErr?.message ?? `Erro ao recriar instância: ${retryRes.status}`);
        }
      } else {
        throw new Error(errBody?.message ?? `Erro ao criar instância: ${createRes.status}`);
      }
    }

    // PASSO 2 — Aguarda a instância inicializar antes de buscar o QR
    toast.info('Aguardando inicialização...');
    await sleep(3000);

    // PASSO 3 — Buscar o QR Code
    const connectRes = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: { 'apikey': EVOLUTION_TOKEN },
    });

    if (!connectRes.ok) {
      const errBody = await connectRes.json().catch(() => ({}));
      throw new Error(errBody?.message ?? `Erro ao buscar QR: ${connectRes.status}`);
    }

    const connectData = await connectRes.json();
    console.log('Evolution connect response:', connectData);

    // PASSO 4 — Extrair o QR Code da resposta
    // A Evolution pode retornar em formatos diferentes dependendo da versão
    const base64QR =
      connectData?.base64 ||
      connectData?.qrcode?.base64 ||
      connectData?.qr?.base64 ||
      connectData?.data?.qrcode?.base64 ||
      null;

    const pairingCode =
      connectData?.pairingCode ||
      connectData?.qrcode?.pairingCode ||
      null;

    if (base64QR) {
      // Garante que tem o prefixo data:image correto
      const qrDataUrl = base64QR.startsWith('data:image')
        ? base64QR
        : `data:image/png;base64,${base64QR}`;

      setQrCode(qrDataUrl);
      toast.success('QR Code gerado! Escaneie com o WhatsApp.');

    } else if (connectData?.instance?.state === 'open') {
      toast.info('Este número já está conectado ao WhatsApp.');

    } else {
      // Log completo para debug
      console.error('Resposta inesperada da Evolution:', JSON.stringify(connectData, null, 2));
      toast.warning('QR Code não retornado. Veja o console para detalhes.');
    }

    // PASSO 5 — Salva o instanceName no Supabase para referência futura
    await supabase
      .from('atendentes')
      .update({ instance_name: instanceName } as never)
      .eq('id', atendente.id);

  } catch (err: any) {
    console.error('Erro ao gerar QR:', err);
    toast.error('Erro ao gerar QR Code: ' + (err?.message ?? 'erro desconhecido'));
  }

  setIsGeneratingQr(null);
};

  const handleVerConversas = (id: string) => {
    navigate(`/gestor/atendentes/${id}/conversas`);
  };

  return (
    <div className="h-full overflow-y-auto p-6 relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atendentes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie equipe e emita pareamento WhatsApp</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-2" /> Adicionar atendente
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">{atendentes.length}</p>
                <p className="text-xs text-muted-foreground">Total de atendentes</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Headphones className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {atendentes.filter((a) => a.status === 'ONLINE').length}
                </p>
                <p className="text-xs text-muted-foreground">Online agora</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {atendentes.reduce((acc, a) => acc + a.leadsAtivos, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Leads ativos total</p>
              </div>
            </Card>
          </div>

          {/* Attendant cards */}
          {atendentes.length === 0 ? (
            <Card className="p-16 text-center">
              <Users className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Nenhum atendente registrado</h3>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Adicione atendentes para começar a distribuir leads
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {atendentes.map((a) => {
                const cap = (a.leadsAtivos / a.max_leads) * 100;
                const capColor = cap > 90 ? 'bg-destructive' : cap > 70 ? 'bg-warning' : 'bg-success';

                return (
                  <Card
                    key={a.id}
                    className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => handleVerConversas(a.id)}
                  >
                    <div className="px-5 pt-5 pb-4 flex items-start gap-4">
                      <div className="relative">
                        <AvatarInicial nome={a.nome} size="lg" />
                        <span className="absolute -bottom-0.5 -right-0.5">
                          <StatusDot status={a.status} />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-foreground truncate">{a.nome}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">
                          {a.status === 'ONLINE' ? '🟢 Online' : a.status === 'OCUPADO' ? '🟡 Ocupado' : '⚫ Offline'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{a.email}</p>
                      </div>
                    </div>

                    <div className="px-5 pb-3 grid grid-cols-3 gap-3">
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-bold font-mono text-foreground">{a.leadsAtivos}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Leads ativos</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-bold font-mono text-foreground">{a.conversoes}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Conversões</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-bold font-mono text-foreground">
                          {a.leadsAtivos > 0 ? Math.round((a.conversoes / a.leadsAtivos) * 100) : 0}%
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Taxa</p>
                      </div>
                    </div>

                    <div className="px-5 pb-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Capacidade</span>
                        <span className="font-mono">{a.leadsAtivos}/{a.max_leads}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted w-full">
                        <div
                          className={`h-2 rounded-full ${capColor} transition-all`}
                          style={{ width: `${Math.min(cap, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Ver painel de rotina</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Toggle ONLINE / OFFLINE */}
                        <button
                          onClick={(e) => handleToggleStatus(a, e)}
                          disabled={togglingStatus === a.id}
                          title={a.status === 'ONLINE' ? 'Pausar atendente' : 'Ativar atendente'}
                          className={`
                            relative inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-semibold
                            transition-all duration-300 cursor-pointer select-none
                            disabled:opacity-60 disabled:cursor-not-allowed
                            ${
                              a.status === 'ONLINE'
                                ? 'bg-green-500/15 text-green-600 hover:bg-red-500/15 hover:text-red-600 border border-green-500/30 hover:border-red-500/30'
                                : 'bg-muted text-muted-foreground hover:bg-green-500/15 hover:text-green-600 border border-border hover:border-green-500/30'
                            }
                          `}
                        >
                          {togglingStatus === a.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : a.status === 'ONLINE' ? (
                            <>
                              <PowerOff className="h-3 w-3" />
                              <span>Parar</span>
                            </>
                          ) : (
                            <>
                              <Power className="h-3 w-3" />
                              <span>Ativar</span>
                            </>
                          )}
                        </button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2 hover:bg-primary/10"
                          onClick={(e) => { e.stopPropagation(); handleGerarQR(a); }}
                          disabled={isGeneratingQr === a.id}
                        >
                          {isGeneratingQr === a.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <QrCode className="h-3 w-3 mr-1" />
                          )}
                          QR
                        </Button>
                        <div className="flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal / Overlay Cadastro + QR Code */}
      {(showModal || qrCode) && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <Card className="max-w-md w-full relative overflow-hidden shadow-2xl">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-10"
              onClick={() => {
                setShowModal(false);
                setQrCode(null);
                setSubmitting(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>

            {qrCode ? (
              <div className="p-8 text-center bg-card">
                <div className="bg-success/10 text-success p-3 rounded-full inline-block mb-4">
                  <Smartphone className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Conecte o Dispositivo</h3>
                <p className="text-sm text-muted-foreground mb-8">
                  Peça ao atendente <strong>{nome}</strong> para escanear com o seu WhatsApp para parear as conversas ativas.
                </p>

                <div className="bg-white p-4 rounded-xl inline-block shadow-sm w-full mx-auto mb-4">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-full object-contain mx-auto aspect-square" />
                </div>

                <Button className="w-full mt-4" onClick={() => { setQrCode(null); setShowModal(false); setNome(''); setEmail(''); setTelefone(''); }}>
                  Concluído
                </Button>
              </div>
            ) : (
              <div className="p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold">Novo Atendente</h3>
                  <p className="text-sm text-muted-foreground">A instância WhatsApp será preparada assim que salvarmos.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Nome Completo</Label>
                    <Input placeholder="Ex: João Silva" value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" placeholder="joao@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>Telefone (WhatsApp)</Label>
                    <Input placeholder="5511999999999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                    <p className="text-xs text-muted-foreground mt-1">Apenas números. Comece pelo código do país (55)</p>
                  </div>
                  <div>
                    <Label>Capacidade (Máx. de Leads)</Label>
                    <Input type="number" min={1} max={100} value={maxLeads} onChange={(e) => setMaxLeads(parseInt(e.target.value) || 10)} />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                  <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                  <Button disabled={submitting} onClick={handleCreateAtendente}>
                    {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adicionando...</> : 'Criar e Gerar QR Code'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
