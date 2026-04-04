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
  Plus, MessageCircle, TrendingUp, Users, ChevronRight, Headphones,
  Loader2, QrCode, RefreshCw, X, Smartphone
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

  // Form
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [maxLeads, setMaxLeads] = useState(10);

  const fetchAtendentes = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from('atendentes')
      .select('*')
      .eq('papel', 'ATENDENTE') as unknown as Promise<{ data: Atendente[] | null; error: any }>);

    if (!error && data) {
      // Injeta métricas default apenas visualmente para manter o Design original intacto
      const a = data.map((d: Atendente) => ({
        ...d,
        leadsAtivos: Math.floor(Math.random() * 5), // provisório
        conversoes: Math.floor(Math.random() * 3),
        naoLidas: 0,
      }));
      setAtendentes(a);
    }
    setLoading(false);
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
    try {
// Override explícito da conexão com os dados do .env passados (exigência do cenário)
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const password = import.meta.env.VITE_SUPABASE_PASSWORD;
      
      console.log('urls' + url, key);
      const localSupabase = createClient(url, key, {
        global: {
           headers: {
             apikey: key,
             Authorization: `Bearer ${key}`
           }
        }
      });

      console.log('Conectado ao Supabase' + localSupabase);
      // 1. Cria o atendente no Supabase de fato conectando explícitamente na key inserida no .env
      const { data: newAtendente, error: dbError } = await (localSupabase
        .from('atendentes')
        .insert({
          nome: nome,
          email: email,
          telefone: telefone,
          papel: 'ATENDENTE',
          status: 'OFFLINE',
          max_leads: maxLeads,
        } as any)
        .select()
        .single() as unknown as Promise<{ data: Atendente | null; error: any }>);

        console.log('Cliente criado');

      if (dbError || !newAtendente) throw new Error(dbError?.message || 'Erro ao criar atendente');

      // 2. Invocar edge function do WhatsApp Connect usando fallbacks do .env lá no servidor
      const instanceName = `tfa-${newAtendente.id.slice(0, 8)}`;
      toast.info('Atendente criado. Gerando QR Code...');

      const { data: qrcData, error: evoError } = await supabase.functions.invoke('whatsapp-connect', {
        body: {
          action: 'create_instance',
          instanceName,
          atendenteId: newAtendente.id,
          atendenteNome: newAtendente.nome,
          phoneNumber: newAtendente.telefone,
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
      toast.error('Falha inesperada');
    }
    setSubmitting(false);
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

                    <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Ver painel de rotina</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all">
                        <ChevronRight className="h-3.5 w-3.5" />
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

                <Button className="w-full mt-4" onClick={() => { setQrCode(null); setShowModal(false);setNome('');setEmail('');setTelefone(''); }}>
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
