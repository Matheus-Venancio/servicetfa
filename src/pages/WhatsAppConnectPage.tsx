import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusDot } from '@/components/StatusDot';
import { toast } from 'sonner';
import {
  Smartphone, Wifi, WifiOff, QrCode, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle, Loader2, Link2,
} from 'lucide-react';

interface Channel {
  id: string;
  instance_name: string;
  phone_number: string | null;
  atendente_id: string;
  atendente_nome: string;
  status: string;
  evolution_api_url: string | null;
  api_key: string | null;
  created_at: string;
}

export default function WhatsAppConnectPage() {
  const user = useAuthStore((s) => s.user);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectingInstance, setConnectingInstance] = useState<string | null>(null);

  // Form state
  const [instanceName, setInstanceName] = useState('');
  const [evolutionUrl, setEvolutionUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadChannels = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('whatsapp-connect', {
      body: { action: 'list_channels' },
    });
    if (data?.channels) {
      const filtered = user?.papel === 'GESTOR'
        ? data.channels
        : data.channels.filter((c: Channel) => c.atendente_id === user?.id);
      setChannels(filtered);
    }
    setLoading(false);
  };

  useEffect(() => { loadChannels(); }, []);

  const handleCreateInstance = async () => {
    if (!instanceName.trim()) {
      toast.error('Informe o nome da instância');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: {
          action: 'create_instance',
          instanceName: instanceName.trim(),
          evolutionApiUrl: evolutionUrl.trim() || null,
          apiKey: apiKey.trim() || null,
          atendenteId: user?.id || '',
          atendenteNome: user?.nome || '',
          phoneNumber: phoneNumber.trim() || null,
        },
      });

      if (error) throw error;

      if (data?.qrcode) {
        setQrCode(data.qrcode);
        setConnectingInstance(instanceName.trim());
      }

      if (data?.error_evolution) {
        toast.warning(data.error_evolution);
      } else {
        toast.success('Canal criado com sucesso!');
      }

      setShowForm(false);
      setInstanceName('');
      setEvolutionUrl('');
      setApiKey('');
      setPhoneNumber('');
      await loadChannels();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar canal');
    }
    setSubmitting(false);
  };

  const handleGetQRCode = async (channel: Channel) => {
    setConnectingInstance(channel.instance_name);
    const { data } = await supabase.functions.invoke('whatsapp-connect', {
      body: { action: 'get_qrcode', instanceName: channel.instance_name },
    });
    if (data?.qrcode) {
      setQrCode(data.qrcode);
    } else {
      toast.error('Não foi possível gerar o QR Code. Verifique a configuração da Evolution API.');
    }
  };

  const handleCheckStatus = async (channel: Channel) => {
    const { data } = await supabase.functions.invoke('whatsapp-connect', {
      body: { action: 'check_status', instanceName: channel.instance_name },
    });
    if (data?.channel) {
      setChannels((prev) => prev.map((c) => c.id === channel.id ? { ...c, status: data.channel.status } : c));
      toast.success(`Status: ${data.channel.status}`);
    }
  };

  const handleDelete = async (channel: Channel) => {
    if (!confirm(`Deseja remover o canal "${channel.instance_name}"?`)) return;
    await supabase.functions.invoke('whatsapp-connect', {
      body: { action: 'delete_channel', instanceName: channel.instance_name },
    });
    toast.success('Canal removido');
    await loadChannels();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'connecting': return <Loader2 className="h-5 w-5 text-warning animate-spin" />;
      default: return <WifiOff className="h-5 w-5 text-destructive" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando...';
      default: return 'Desconectado';
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-success" />
              </div>
              Conexão WhatsApp
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Conecte seu número do WhatsApp para receber e enviar mensagens pela plataforma
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} aria-label="Adicionar canal">
            <Plus className="h-4 w-4 mr-2" /> Novo Canal
          </Button>
        </div>

        {/* Info banner */}
        <Card className="p-4 mb-6 border-info/20 bg-info/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-info shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground mb-1">Como funciona a integração?</p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                <li>Configure sua <strong>Evolution API</strong> (servidor que conecta ao WhatsApp)</li>
                <li>Crie um canal informando a URL da API e sua chave de acesso</li>
                <li>Escaneie o QR Code com o WhatsApp do número que deseja conectar</li>
                <li>As mensagens serão espelhadas automaticamente na plataforma</li>
              </ol>
            </div>
          </div>
        </Card>

        {/* QR Code modal */}
        {qrCode && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setQrCode(null); setConnectingInstance(null); }}>
            <Card className="p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <QrCode className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-1">Escaneie o QR Code</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Abra o WhatsApp no celular → Menu → Dispositivos conectados → Conectar dispositivo
                </p>
                <div className="bg-white p-4 rounded-xl inline-block mb-4">
                  <img src={`data:image/png;base64,${qrCode}`} alt="QR Code WhatsApp" className="w-64 h-64" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Instância: <span className="font-mono">{connectingInstance}</span>
                </p>
                <div className="flex gap-2 mt-4 justify-center">
                  <Button variant="outline" onClick={() => { setQrCode(null); setConnectingInstance(null); }}>
                    Fechar
                  </Button>
                  <Button onClick={() => { loadChannels(); setQrCode(null); setConnectingInstance(null); }}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Verificar conexão
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <Card className="p-6 mb-6 border-primary/20">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Configurar novo canal WhatsApp
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="instanceName">Nome da instância *</Label>
                <Input
                  id="instanceName"
                  placeholder="ex: tfa-ana-costa"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Identificador único, sem espaços</p>
              </div>
              <div>
                <Label htmlFor="phoneNumber">Número do WhatsApp</Label>
                <Input
                  id="phoneNumber"
                  placeholder="ex: 5511999990010"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="evolutionUrl">URL da Evolution API</Label>
                <Input
                  id="evolutionUrl"
                  placeholder="ex: https://evolution.suaempresa.com"
                  value={evolutionUrl}
                  onChange={(e) => setEvolutionUrl(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="apiKey">Chave da API (apikey)</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Sua chave da Evolution API"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleCreateInstance} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wifi className="h-4 w-4 mr-2" />}
                Criar e conectar
              </Button>
            </div>
          </Card>
        )}

        {/* Channels list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : channels.length === 0 ? (
          <Card className="p-16 text-center">
            <Smartphone className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Nenhum canal conectado</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">Clique em "Novo Canal" para conectar seu WhatsApp</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((channel) => (
              <Card key={channel.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                        {getStatusIcon(channel.status)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm">{channel.instance_name}</h3>
                        <p className="text-xs text-muted-foreground">{channel.atendente_nome}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      channel.status === 'connected' ? 'bg-success/10 text-success' :
                      channel.status === 'connecting' ? 'bg-warning/10 text-warning' :
                      'bg-destructive/10 text-destructive'
                    }`}>
                      {getStatusLabel(channel.status)}
                    </span>
                  </div>

                  {channel.phone_number && (
                    <p className="text-sm text-muted-foreground mb-3 font-mono">
                      📱 +{channel.phone_number}
                    </p>
                  )}

                  {channel.evolution_api_url && (
                    <p className="text-xs text-muted-foreground truncate mb-3">
                      🔗 {channel.evolution_api_url}
                    </p>
                  )}
                </div>

                <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center gap-2">
                  {channel.status !== 'connected' && channel.evolution_api_url && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleGetQRCode(channel)}>
                      <QrCode className="h-3 w-3 mr-1" /> QR Code
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleCheckStatus(channel)}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Status
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7 text-destructive hover:text-destructive" onClick={() => handleDelete(channel)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Remover
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
