import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AvatarInicial } from '@/components/AvatarInicial';
import { StatusDot } from '@/components/StatusDot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft, Search, Send, Loader2, RefreshCw,
  MessageCircle, Wifi, WifiOff, Clock, CheckCheck, AlertTriangle
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface EvoChat {
  id: string;
  contactName?: string | null;
  lastMessage?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
    };
    messageType?: string;
    message?: any;
    messageTimestamp?: number;
    pushName?: string;
  };
  unreadCount?: number;
}

interface EvoMessage {
  key: { id: string; fromMe: boolean; remoteJid: string };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { caption?: string; url?: string; jpegThumbnail?: string };
    documentMessage?: { caption?: string; fileName?: string; url?: string };
    videoMessage?: { caption?: string; url?: string };
    audioMessage?: { url?: string; ptt?: boolean; seconds?: number };
    stickerMessage?: { url?: string };
  };
  messageTimestamp?: number;
  pushName?: string;
  messageType?: string;
}

interface Atendente {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  status: string;
  max_leads: number;
}

interface Channel {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extrairTexto(msg?: EvoMessage['message']): string {
  if (!msg) return '[Mídia]';
  if (msg.imageMessage) return msg.imageMessage.caption || '📷 Imagem';
  if (msg.documentMessage) return `📄 ${msg.documentMessage.fileName || 'Documento'}`;
  if (msg.videoMessage) return msg.videoMessage.caption || '🎥 Vídeo';
  if (msg.audioMessage) return '🎵 Áudio';
  if (msg.stickerMessage) return '[Figurinha]';
  return msg.conversation || msg.extendedTextMessage?.text || '[Mídia]';
}


function formatarHora(ts?: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarData(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const hj = new Date();
  if (d.toDateString() === hj.toDateString()) return 'Hoje';
  const on = new Date(hj); on.setDate(hj.getDate() - 1);
  if (d.toDateString() === on.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function phoneLabel(jid: string | null | undefined): string {
  if (!jid) return 'Desconhecido';
  return jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}

function chatLabel(chat: EvoChat): string {
  if (chat.contactName) return chat.contactName;
  if (chat.lastMessage?.pushName && chat.lastMessage.pushName !== 'Você') return chat.lastMessage.pushName;
  return phoneLabel(chat.id);
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const POLL_INTERVAL = 7000;

// ─── Componente ───────────────────────────────────────────────────────────────
export default function AtendenteConversasPage() {
  const { atendenteId } = useParams<{ atendenteId: string }>();
  const navigate = useNavigate();
  const mediaCache = useRef<Record<string, string>>({});
  const [atendente, setAtendente] = useState<Atendente | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [instanceName, setInstanceName] = useState<string>('');
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [chats, setChats] = useState<EvoChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [messages, setMessages] = useState<EvoMessage[]>([]);
  const [editingMsg, setEditingMsg] = useState<EvoMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [busca, setBusca] = useState('');

  // Campo para o gestor digitar o instance name manualmente se não estiver no banco
  const [manualInstance, setManualInstance] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  console.log("ATENDENTE ID NOVO", atendenteId)
  // ── 1. Carrega atendente + canal do Supabase ──────────────────────────────
  useEffect(() => {
    if (!atendenteId) return;
    (async () => {
      setLoadingSetup(true);
      setSetupError(null);

      const { data: a, error: aErr } = await (supabase
        .from('atendentes').select('*').eq('id', atendenteId).single() as any);
      console.log("ATENDENTE banco de dados", a)
      if (aErr || !a) {
        setSetupError('Atendente não encontrado no banco de dados.');
        setLoadingSetup(false);
        return;
      }
      setAtendente(a);

      const { data: ch } = await (supabase
        .from('whatsapp_channels').select('*').eq('atendente_id', atendenteId).maybeSingle() as any);
      console.log("CANAL banco de dados", ch)
      if (ch) {
        setChannel(ch);
        setInstanceName(ch.instance_name);
      }
      setLoadingSetup(false);
    })();
  }, [atendenteId]);

  // ── 2. Proxy via Edge Function (evita CORS) ───────────────────────────────
  const callMirror = useCallback(async (body: object) => {
    const { data, error } = await supabase.functions.invoke('whatsapp-mirror', { body });

    // Erro de rede / autenticação do próprio Supabase
    if (error) {
      // Tenta extrair o body real do erro
      let detail = error.message;
      try {
        const ctx = (error as any).context;
        if (ctx) {
          const bodyText = typeof ctx.json === 'function' ? await ctx.json() : null;
          if (bodyText?.error) detail = bodyText.error;
        }
      } catch { }
      throw new Error(detail);
    }

    // Erro da Evolution API (retornado com ok: false no body)
    if (data?.ok === false) {
      throw new Error(data.error || 'Erro desconhecido na Evolution API');
    }

    return data;
  }, []);

  // ── 3. Busca lista de chats ───────────────────────────────────────────────
  const fetchChats = useCallback(async (inst?: string) => {
    const iName = inst || instanceName;
    if (!iName) return;
    setLoadingChats(true);
    setChatsError(null);

    try {
      const data = await callMirror({ action: 'get_chats', instanceName: iName, atendenteId });
      const lista: EvoChat[] = (data.chats ?? []);
      console.log("LISTA DE CONVERSAS", lista)
      lista.sort((a, b) => (b.lastMessage?.messageTimestamp ?? 0) - (a.lastMessage?.messageTimestamp ?? 0));
      setChats(lista);

      if (lista.length === 0) {
        setChatsError('Nenhuma conversa encontrada.');
      }
    } catch (e: any) {
      setChatsError('Erro ao carregar conversas: ' + e.message);
    }

    setLoadingChats(false);
  }, [instanceName, atendenteId, callMirror]);

  useEffect(() => {
    if (instanceName) fetchChats();
  }, [instanceName]);

  const instanceNameRef = useRef(instanceName);
  useEffect(() => { instanceNameRef.current = instanceName; }, [instanceName]);

  // ── 4. Busca mensagens de um chat ─────────────────────────────────────────
  const fetchMessages = useCallback(async (jid: string) => {
    const inst = instanceNameRef.current;
    if (!inst || !jid) return;
    setLoadingMsgs(true);
    try {
      const data = await callMirror({
        action: 'get_messages',
        instanceName: inst,
        remoteJid: jid,
      });

      console.log('[Mirror] get_messages RAW:', data);
      console.log('[DEBUG] get_messages resposta completa:', JSON.stringify(data));
      console.log('[DEBUG] instanceName usado:', inst);
      console.log('[DEBUG] remoteJid enviado:', jid);

      const raw: any[] =
        data?.messages?.records ??
        data?.messages ??
        data?.records ??
        (Array.isArray(data) ? data : []);

      const seen = new Set<string>();
      const lista: EvoMessage[] = raw
        .filter((m: any) => m?.key?.id != null)
        .filter((m: any) => {
          if (seen.has(m.key.id)) return false;
          seen.add(m.key.id);
          return true;
        });

      lista.sort((a, b) => (a.messageTimestamp ?? 0) - (b.messageTimestamp ?? 0));
      setMessages(lista);
      console.log('[Mirror] mensagens processadas:', lista.length);
    } catch (e: any) {
      console.error('[Mirror] fetchMessages ERRO:', e.message);
      toast.error('Erro ao carregar mensagens: ' + e.message);
    }
    setLoadingMsgs(false);
  }, [callMirror]); // ← remove instanceName das deps, usa ref

  // Polling de mensagens
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selectedJid) return;
    fetchMessages(selectedJid);
    pollRef.current = setInterval(() => {
      if (!isPlayingAudio) fetchMessages(selectedJid); // ← não atualiza se estiver ouvindo
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedJid, fetchMessages, isPlayingAudio]);

  // Auto-scroll
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── 5. Enviar mensagem ────────────────────────────────────────────────────
  const handleSend = async () => {
    if ((!input.trim() && !attachFile) || !selectedJid || !instanceNameRef.current) return;
    setSending(true);
    const texto = input.trim();
    setInput('');

    try {
      if (attachFile && attachPreview) {
        // Remove o prefixo "data:image/jpeg;base64," — envia só o base64 puro
        const base64 = attachPreview.split(',')[1];
        const isImage = attachFile.type.startsWith('image/');
        const mediatype = isImage ? 'image' : 'document';

        await callMirror({
          action: 'send_media',
          instanceName: instanceNameRef.current,
          number: phoneLabel(selectedJid),
          mediatype,
          mimetype: attachFile.type,
          fileName: attachFile.name,
          caption: texto,
          mediaBase64: base64,
        });

        setAttachFile(null);
        setAttachPreview(null);
      } else {
        await callMirror({
          action: 'send_message',
          instanceName: instanceNameRef.current,
          numero: phoneLabel(selectedJid),
          message: texto,
        });
      }

      setTimeout(() => fetchMessages(selectedJid), 1500);
    } catch (e: any) {
      toast.error('Falha ao enviar: ' + e.message);
      setInput(texto);
    }

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── 6. Conectar instância manualmente ─────────────────────────────────────
  const handleConectarManual = async () => {
    if (!manualInstance.trim()) return;
    const inst = manualInstance.trim();

    // Salva no banco vinculado ao atendente
    await (supabase.from('whatsapp_channels').upsert({
      instance_name: inst,
      evolution_api_url: 'https://evolution.innovatedigitals.com.br',
      api_key: 'd3b7573358045479207c1e94adfbf4a3',
      atendente_id: atendenteId,
      atendente_nome: atendente?.nome,
      phone_number: atendente?.telefone,
      status: 'connected',
    } as any, { onConflict: 'instance_name' }) as any);

    setInstanceName(inst);
    toast.success(`Instância "${inst}" vinculada. Buscando conversas...`);
    fetchChats(inst);
  };

  const handleEditMessage = async () => {
    if (!editingMsg || !editText.trim()) return;
    try {
      await callMirror({
        action: 'edit_message',
        instanceName: instanceNameRef.current,
        messageKeyId: editingMsg.key.id,
        remoteJid: editingMsg.key.remoteJid,
        number: phoneLabel(editingMsg.key.remoteJid),
        newText: editText.trim(),
      });
      // Atualiza localmente
      setMessages(prev => prev.map(m =>
        m.key.id === editingMsg.key.id
          ? { ...m, message: { conversation: editText.trim() } }
          : m
      ));
      toast.success('Mensagem editada.');
      setEditingMsg(null);
      setEditText('');
    } catch (e: any) {
      toast.error('Erro ao editar: ' + e.message);
    }
  };

  const handleDeleteMessage = async (msg: EvoMessage) => {
    if (!msg.key.fromMe) return;
    if (!confirm('Apagar esta mensagem?')) return;

    try {
      await callMirror({
        action: 'delete_message',
        instanceName: instanceNameRef.current,
        messageKeyId: msg.key.id,        // ← era messageId, agora messageKeyId
        remoteJid: msg.key.remoteJid,
      });
      setMessages(prev => prev.filter(m => m.key.id !== msg.key.id));
      toast.success('Mensagem apagada.');
    } catch (e: any) {
      toast.error('Erro ao apagar: ' + e.message);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limite de 16MB
    if (file.size > 16 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 16MB.');
      return;
    }

    setAttachFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setAttachPreview(reader.result as string); // data:image/jpeg;base64,...
    };
    reader.readAsDataURL(file);

    // Reseta o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  const getMediaUrl = useCallback(async (messageId: string, mediaType?: string): Promise<string | null> => {
    if (mediaCache.current[messageId]) return mediaCache.current[messageId];
    try {
      const data = await callMirror({
        action: 'get_media',
        instanceName: instanceNameRef.current,
        messageId,
        mediaType, // ← passa o tipo para a edge function saber se converte
      });
      if (!data?.base64) return null;

      // Força mimetype correto para áudio — browser precisa de mp4 ou mpeg
      let mimetype = data.mimetype || 'application/octet-stream';
      if (mediaType === 'audioMessage') mimetype = 'audio/mp4';

      const url = `data:${mimetype};base64,${data.base64}`;
      mediaCache.current[messageId] = url;
      return url;
    } catch { return null; }
  }, [callMirror]);

  function MsgMedia({ msg, getMediaUrl, onAudioPlay, onAudioStop }: {
    msg: EvoMessage;
    getMediaUrl: (id: string, mediaType?: string) => Promise<string | null>;
    onAudioPlay: () => void;
    onAudioStop: () => void;
  }) {
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const m = msg.message;

    const load = async (mediaType?: string) => {
      if (mediaUrl || loading) return;
      setLoading(true);
      const url = await getMediaUrl(msg.key.id, mediaType);
      setMediaUrl(url);
      setLoading(false);
    };

    if (!m) return <span className="text-sm italic text-[#8696a0]">[Mídia]</span>;

    // ── Imagem ──
    if (m.imageMessage) {
      const thumb = m.imageMessage.jpegThumbnail
        ? `data:image/jpeg;base64,${m.imageMessage.jpegThumbnail}`
        : null;
      return (
        <div className="flex flex-col gap-1">
          <img
            src={mediaUrl || thumb || ''}
            className="rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            style={{ maxWidth: 220, width: '100%', height: 'auto' }} // ← tamanho natural
            onClick={async () => {
              await load();
              const src = mediaUrl || thumb;
              if (!src) return;
              const w = window.open('');
              w?.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${src}" style="max-width:100%;max-height:100vh;object-fit:contain"></body></html>`);
            }}
            title="Clique para ampliar"
          />
          {m.imageMessage.caption && (
            <p className="text-sm whitespace-pre-wrap break-words">{m.imageMessage.caption}</p>
          )}
        </div>
      );
    }

    // ── Áudio ──
    if (m.audioMessage) {
      return (
        <div className="flex items-center gap-2 min-w-[200px]">
          <span style={{ fontSize: 18 }}>🎵</span>
          {mediaUrl ? (
            <audio
              controls
              src={mediaUrl}
              className="flex-1"
              style={{ height: 32, minWidth: 160 }}
              onPlay={onAudioPlay}
              onPause={onAudioStop}
              onEnded={onAudioStop}
            />
          ) : (
            <button
              onClick={() => load('audioMessage')} // ← passa o tipo
              disabled={loading}
              className="flex items-center gap-2 bg-black/5 rounded-full px-3 py-1.5 hover:bg-black/10 transition-colors"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin text-[#54656f]" />
                : <span className="text-sm text-[#54656f]">▶ Carregar áudio</span>
              }
            </button>
          )}
        </div>
      );
    }

    // ── Documento ──
    if (m.documentMessage) {
      const fileName = m.documentMessage.fileName || 'documento';
      return (
        <div
          className="flex items-center gap-2 bg-black/5 rounded-lg px-3 py-2 min-w-[160px] cursor-pointer hover:bg-black/10 transition-colors"
          onClick={async () => {
            await load();
            if (!mediaUrl) { toast.error('Não foi possível carregar o arquivo.'); return; }
            const a = document.createElement('a');
            a.href = mediaUrl;
            a.download = fileName;
            a.click();
          }}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin text-[#54656f]" /> : <span style={{ fontSize: 24 }}>📄</span>}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{fileName}</p>
            <p className="text-xs text-[#54656f]">{mediaUrl ? 'Baixar' : 'Toque para baixar'}</p>
          </div>
        </div>
      );
    }

    // ── Vídeo ──
    if (m.videoMessage) {
      return (
        <div className="flex flex-col gap-1">
          {mediaUrl ? (
            <video controls src={mediaUrl} className="rounded-lg" style={{ maxWidth: 220 }} />
          ) : (
            <button onClick={load} disabled={loading}
              className="flex items-center gap-2 bg-black/5 rounded-lg px-3 py-2 hover:bg-black/10">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span style={{ fontSize: 24 }}>🎥</span>}
              <span className="text-sm text-[#54656f]">{loading ? 'Carregando...' : 'Toque para ver vídeo'}</span>
            </button>
          )}
          {m.videoMessage.caption && <p className="text-sm">{m.videoMessage.caption}</p>}
        </div>
      );
    }

    if (m.stickerMessage) return <span className="text-sm italic text-[#8696a0]">[Figurinha]</span>;

    const texto = m.conversation || m.extendedTextMessage?.text || '';
    return <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{texto}</p>;
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (e) {
      toast.error('Permissão de microfone negada.');
    }
  };

  const stopRecording = () => {
    return new Promise<string>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder) return resolve('');

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);

        // Para todas as tracks do microfone
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      setRecordingSeconds(0);
    });
  };

  const handleAudioSend = async () => {
    const base64 = await stopRecording();
    if (!base64 || !selectedJid) return;
    setSending(true);
    try {
      await callMirror({
        action: 'send_audio',
        instanceName: instanceNameRef.current,
        number: phoneLabel(selectedJid),
        audioBase64: base64,
      });
      setTimeout(() => fetchMessages(selectedJid), 1500);
      toast.success('Áudio enviado.');
    } catch (e: any) {
      toast.error('Erro ao enviar áudio: ' + e.message);
    }
    setSending(false);
  };

  const cancelRecording = () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder) {
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorder.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const formatRecordingTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Agrupamento por data ──────────────────────────────────────────────────
  const groupedMessages = (() => {
    const groups: { date: string; msgs: EvoMessage[] }[] = [];
    messages.forEach((m) => {
      const d = formatarData(m.messageTimestamp);
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.msgs.push(m);
      else groups.push({ date: d, msgs: [m] });
    });
    return groups;
  })();

  // Onde define chatsFiltrados, troca para:
  const chatsFiltrados = chats.filter(c =>
    chatLabel(c).toLowerCase().includes(busca.toLowerCase()) ||
    phoneLabel(c.id).includes(busca)
  );

  // ── Loading setup ─────────────────────────────────────────────────────────
  if (loadingSetup) {
    return (
      <div className="h-full flex items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando dados do atendente...</span>
      </div>
    );
  }

  if (setupError || !atendente) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground text-sm">{setupError || 'Atendente não encontrado.'}</p>
        <Button variant="outline" onClick={() => navigate('/gestor/atendentes')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  // ── SEM INSTÂNCIA — permite digitar manualmente ───────────────────────────
  if (!instanceName) {
    return (
      <div className="h-full flex flex-col">
        <div className="h-12 px-4 flex items-center gap-3 border-b border-border bg-card shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/gestor/atendentes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <AvatarInicial nome={atendente.nome} size="sm" />
          <div>
            <h2 className="text-sm font-semibold">{atendente.nome}</h2>
            <p className="text-xs text-muted-foreground">{atendente.telefone || 'sem telefone'}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <WifiOff className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-1">Instância não vinculada</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Não encontramos uma instância WhatsApp vinculada a <strong>{atendente.nome}</strong> no banco.
              Digite o nome da instância dela no Evolution API para conectar.
            </p>
          </div>

          <div className="flex gap-2 w-full max-w-xs">
            <Input
              placeholder="Ex: atendente"
              value={manualInstance}
              onChange={(e) => setManualInstance(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConectarManual()}
            />
            <Button onClick={handleConectarManual} disabled={!manualInstance.trim()}>
              Conectar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O nome da instância é o <code>instanceName</code> cadastrado no Evolution API
            (ex: <code>atendente</code>, <code>tfa-abc12345</code>)
          </p>
        </div>
      </div>
    );
  }

  // ── Interface principal — Espelho WhatsApp ────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-12 px-4 flex items-center gap-3 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/gestor/atendentes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="relative">
          <AvatarInicial nome={atendente.nome} size="sm" />
          <span className="absolute -bottom-0.5 -right-0.5"><StatusDot status={atendente.status as any} /></span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{atendente.nome}</h2>
          <div className="flex items-center gap-1.5">
            <Wifi className="h-3 w-3 text-success" />
            <span className="text-xs text-success">Instância: <code className="font-mono">{instanceName}</code></span>
          </div>
        </div>
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => fetchChats()} title="Atualizar lista"
          disabled={loadingChats}
        >
          <RefreshCw className={`h-4 w-4 ${loadingChats ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Lista de conversas — ocupa a tela inteira */}
      <div className="flex-1 overflow-hidden flex flex-col bg-card">
        {/* Busca */}
        <div className="p-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 text-sm bg-muted/50"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loadingChats && chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Buscando conversas...</p>
            </div>
          ) : chatsError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center py-8">
              <AlertTriangle className="h-10 w-10 text-warning/60" />
              <p className="text-xs text-muted-foreground">{chatsError}</p>
              <Button size="sm" variant="outline" onClick={() => fetchChats()}>
                <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
              </Button>
            </div>
          ) : chatsFiltrados.length === 0 && !loadingChats ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 px-4 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            chatsFiltrados.map((chat) => {
              const isSelected = selectedJid === chat.id;
              const lastText = extrairTexto(chat.lastMessage?.message as any);
              return (
                <button
                  key={chat.id}
                  onClick={() => {
                    setSelectedName(chatLabel(chat));
                    setSelectedJid(chat.id);
                    setMessages([]);
                  }}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-border/40 transition-all duration-150 ${isSelected
                    ? 'bg-primary/10 border-l-[3px] border-l-primary'
                    : 'hover:bg-muted/60 border-l-[3px] border-l-transparent'
                    }`}
                >
                  <AvatarInicial nome={chatLabel(chat)} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-sm text-foreground truncate">{chatLabel(chat)}</span>
                      {chat.lastMessage?.messageTimestamp && (
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {formatarData(chat.lastMessage.messageTimestamp)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{lastText}</p>
                  </div>
                  {(chat.unreadCount ?? 0) > 0 && (
                    <span className="bg-success text-white text-[10px] rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center font-mono shrink-0">
                      {chat.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── POPUP MODAL de conversa ── */}
      {selectedJid && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            // fecha ao clicar fora do modal
            if (e.target === e.currentTarget) {
              setSelectedJid(null);
              setMessages([]);
            }
          }}
        >
          <div
            className="flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{ width: '480px', height: '680px', maxWidth: '95vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do popup */}
            <div
              className="flex items-center gap-3 px-4 py-3 shrink-0"
              style={{ backgroundColor: '#075e54' }}
            >
              <AvatarInicial nome={selectedName} size="md" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-sm truncate">{selectedName}</h3>
                <p className="text-xs text-white/70">{phoneLabel(selectedJid)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => selectedJid && fetchMessages(selectedJid)}
                  className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                  title="Atualizar mensagens"
                >
                  <RefreshCw className={`h-4 w-4 text-white ${loadingMsgs ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => { setSelectedJid(null); setMessages([]); }}
                  className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                  title="Fechar"
                >
                  <span className="text-white text-lg leading-none">×</span>
                </button>
              </div>
            </div>

            {/* Área de mensagens */}
            <div
              className="flex-1 overflow-y-auto px-4 py-3 relative"
              style={{
                backgroundColor: '#efeae2',
                backgroundImage: 'url("https://w0.peakpx.com/wallpaper/818/148/HD-wallpaper-whatsapp-background-solid-color-whatsapp-backgrounds-thumbnail.jpg")',
                backgroundRepeat: 'repeat',
                backgroundSize: '400px',
                backgroundBlendMode: 'overlay',
              }}
            >
              {loadingMsgs && messages.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <span className="bg-white px-4 py-2 rounded-full shadow text-sm text-[#111b21] animate-pulse">
                    Carregando mensagens...
                  </span>
                </div>
              )}

              {groupedMessages.map((group, gIdx) => (
                <div key={group.date ?? `group-${gIdx}`}>
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] text-[#54656f] bg-white/90 px-3 py-1 rounded-lg shadow-sm">
                      {group.date}
                    </span>
                  </div>
                  {group.msgs.map((msg, idx) => {
                    const isMine = msg.key.fromMe;
                    const texto = extrairTexto(msg.message);
                    const hora = formatarHora(msg.messageTimestamp);
                    const uniqueKey = msg.key?.id ?? `${msg.messageTimestamp}-${idx}`;
                    return (
                      <div key={uniqueKey} className={`flex mb-1 group ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className="relative">
                          {/* Botão apagar — só aparece no hover de mensagens minhas */}
                          {/* Botões hover — só em mensagens minhas */}
                          {isMine && (
                            <>
                              <button
                                onClick={() => { setEditingMsg(msg); setEditText(extrairTexto(msg.message)); }}
                                className="absolute -left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-black/10"
                                title="Editar mensagem"
                              >
                                <span style={{ fontSize: 14, color: '#54656f' }}>✏️</span>
                              </button>
                              <button
                                onClick={() => handleDeleteMessage(msg)}
                                className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-black/10"
                                title="Apagar mensagem"
                              >
                                <span style={{ fontSize: 14, color: '#54656f' }}>🗑</span>
                              </button>
                            </>
                          )}
                          <div className={`max-w-[80%] rounded-lg px-3 py-1.5 shadow-sm ${isMine
                            ? 'bg-[#d9fdd3] text-[#111b21] rounded-br-none'
                            : 'bg-white text-[#111b21] rounded-bl-none'
                            }`}>
                            {!isMine && msg.pushName && (
                              <p className="text-xs font-semibold text-primary mb-0.5">{msg.pushName}</p>
                            )}

                            {/* ← substitui o <p> de texto pelo componente */}
                            <MsgMedia
                              msg={msg}
                              getMediaUrl={getMediaUrl}
                              onAudioPlay={() => setIsPlayingAudio(true)}
                              onAudioStop={() => setIsPlayingAudio(false)}
                            />

                            <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-[10px] text-[#54656f]">{hora}</span>
                              {isMine && <CheckCheck className="h-3 w-3 text-[#53bdeb]" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {messages.length === 0 && !loadingMsgs && (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <MessageCircle className="h-10 w-10 text-[#54656f]/30" />
                  <p className="text-sm text-[#54656f]">Nenhuma mensagem encontrada</p>
                  <button
                    onClick={() => selectedJid && fetchMessages(selectedJid)}
                    className="text-xs text-blue-500 underline mt-1"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Composer */}
            <div className="px-3 py-2 shrink-0" style={{ backgroundColor: '#f0f2f5' }}>
              {attachPreview && (
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 mb-2 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#111b21] truncate">{attachFile?.name}</p>
                    <p className="text-[10px] text-[#54656f]">{attachFile ? (attachFile.size / 1024).toFixed(1) + ' KB' : ''}</p>
                  </div>
                  {attachPreview.startsWith('data:image') && (
                    <img src={attachPreview} className="h-10 w-10 object-cover rounded-lg shrink-0" />
                  )}
                  <button onClick={() => { setAttachFile(null); setAttachPreview(null); }}
                    className="p-1 rounded-full hover:bg-gray-100 shrink-0">
                    <span style={{ fontSize: 16, color: '#54656f' }}>×</span>
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                {isRecording ? (
                  // ── Modo gravação ──
                  <>
                    <button onClick={cancelRecording}
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 hover:bg-black/5"
                      title="Cancelar">
                      <span style={{ fontSize: 20, color: '#e53e3e' }}>×</span>
                    </button>

                    <div className="flex-1 bg-white rounded-2xl px-4 py-2 shadow-sm flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                      <span className="text-sm text-[#111b21] font-mono">{formatRecordingTime(recordingSeconds)}</span>
                      <span className="text-xs text-[#54656f]">Gravando...</span>
                    </div>

                    <button onClick={handleAudioSend} disabled={sending}
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: '#075e54' }}
                      title="Enviar áudio">
                      {sending
                        ? <Loader2 className="h-4 w-4 animate-spin text-white" />
                        : <Send className="h-4 w-4 text-white" />}
                    </button>
                  </>
                ) : (
                  // ── Modo normal ──
                  <>
                    <button onClick={() => fileInputRef.current?.click()}
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 hover:bg-black/5 transition-colors"
                      title="Anexar arquivo">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </button>

                    <input ref={fileInputRef} type="file"
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                      className="hidden" onChange={handleFileSelect} />

                    <div className="flex-1 bg-white rounded-2xl px-4 py-2 shadow-sm">
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={attachFile ? 'Adicione uma legenda...' : 'Digite uma mensagem...'}
                        className="w-full resize-none bg-transparent text-sm text-[#111b21] placeholder:text-[#8696a0] outline-none min-h-[20px] max-h-[80px]"
                        rows={1}
                      />
                    </div>

                    {/* Microfone ou Enviar */}
                    {input.trim() || attachFile ? (
                      <Button onClick={handleSend} size="icon"
                        disabled={(!input.trim() && !attachFile) || sending}
                        className="h-10 w-10 rounded-full shrink-0"
                        style={{ backgroundColor: '#075e54' }}>
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    ) : (
                      <button onClick={startRecording}
                        className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 hover:bg-black/5 transition-colors"
                        title="Gravar áudio">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          {editingMsg && (
            <div className="absolute inset-0 z-20 flex items-end justify-center pb-4 px-4"
              style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
              onClick={(e) => { if (e.target === e.currentTarget) { setEditingMsg(null); setEditText(''); } }}
            >
              <div className="bg-white rounded-2xl shadow-xl w-full p-4 flex flex-col gap-3">
                <p className="text-xs text-[#54656f] font-medium">Editar mensagem</p>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full resize-none text-sm text-[#111b21] border border-gray-200 rounded-lg px-3 py-2 outline-none min-h-[60px]"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setEditingMsg(null); setEditText(''); }}
                    className="px-4 py-1.5 text-sm text-[#54656f] border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleEditMessage}
                    disabled={!editText.trim()}
                    className="px-4 py-1.5 text-sm text-white rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#075e54' }}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
