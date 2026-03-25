import { useMemo, useRef, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConversaStore } from '@/stores/conversaStore';
import { useAuthStore } from '@/stores/authStore';
import { MOCK_ATENDENTES } from '@/lib/mockData';
import { AvatarInicial } from '@/components/AvatarInicial';
import { ScoreBadge, StatusBadge } from '@/components/Badges';
import { BolhaMensagem, TypingIndicator } from '@/components/BolhaMensagem';
import { TempoRelativo, formatarDataSeparador } from '@/components/TempoRelativo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Search, Send, Paperclip, Smile, Zap, MessageCircle, ArrowRightLeft, Shield, UserCheck, Phone, Mail, MapPin, Calendar, DollarSign, UsersIcon,
} from 'lucide-react';

export default function ConversasPage({ role, filterByAtendente }: { role: 'GESTOR' | 'ATENDENTE'; filterByAtendente?: string }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    leads, leadSelecionado, mensagens, busca, setBusca, digitando,
    setLeadSelecionado, enviarMensagem, assumirConversa, redistribuirLead,
    filtroSidebar, setFiltroSidebar,
  } = useConversaStore();

  const [input, setInput] = useState('');
  const [modo, setModo] = useState<'mensagem' | 'nota'>('mensagem');
  const [showRedistribuir, setShowRedistribuir] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Filter leads based on role
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (filterByAtendente) {
      result = result.filter((l) => l.atendenteNome === filterByAtendente);
    } else if (role === 'ATENDENTE' && user) {
      result = result.filter((l) => l.atendenteNome === user.nome);
    }
    if (filtroSidebar === 'nao_atribuidas') result = result.filter((l) => !l.atendenteNome);
    if (filtroSidebar === 'suas') result = result.filter((l) => l.atendenteNome === user?.nome);
    if (filtroSidebar === 'nao_respondidas') result = result.filter((l) => l.naoLidas > 0);
    if (busca) result = result.filter((l) => l.nome.toLowerCase().includes(busca.toLowerCase()));
    return result;
  }, [leads, role, user, filtroSidebar, busca]);

  // Select lead from URL
  useEffect(() => {
    if (id) {
      const lead = leads.find((l) => l._id === id);
      if (lead) setLeadSelecionado(lead);
    }
  }, [id, leads]);

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensagens, digitando]);

  const handleSend = () => {
    if (!input.trim() || !leadSelecionado) return;
    enviarMensagem(input, modo, user?.nome || 'Atendente');
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSelectLead = (lead: typeof leads[0]) => {
    setLeadSelecionado(lead);
    const base = role === 'GESTOR' ? '/gestor/conversas' : '/atendente/conversas';
    navigate(`${base}/${lead._id}`);
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; msgs: typeof mensagens }[] = [];
    mensagens.forEach((msg) => {
      const dateKey = formatarDataSeparador(msg.criadoEm);
      const last = groups[groups.length - 1];
      if (last && last.date === dateKey) {
        last.msgs.push(msg);
      } else {
        groups.push({ date: dateKey, msgs: [msg] });
      }
    });
    return groups;
  }, [mensagens]);

  const sidebarFilters = [
    { key: 'todas', label: 'Todas as conversas', count: leads.length },
    { key: 'suas', label: 'Suas conversas', count: leads.filter((l) => l.atendenteNome === user?.nome).length },
    { key: 'nao_respondidas', label: 'Não respondidas', count: leads.filter((l) => l.naoLidas > 0).length, badge: true },
    { key: 'nao_atribuidas', label: 'Não atribuídas', count: leads.filter((l) => !l.atendenteNome).length },
  ];

  return (
    <div className="flex h-full">
      {/* Column 1 — Conversation list */}
      <div className="w-72 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground text-sm">
              {role === 'GESTOR' ? 'Todas as conversas' : 'Suas conversas'}
            </h2>
            <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 font-mono">
              {filteredLeads.length}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </div>

        {/* Sidebar filters */}
        <div className="px-2 py-2 border-b border-border space-y-0.5">
          {sidebarFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltroSidebar(f.key)}
              className={`w-full flex items-center justify-between text-sm px-3 py-1.5 rounded-md transition-colors ${
                filtroSidebar === f.key ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <span>{f.label}</span>
              <span className={`text-xs font-mono ${f.badge && f.count > 0 ? 'bg-destructive text-destructive-foreground rounded-full px-1.5' : ''}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Lead list */}
        <div className="flex-1 overflow-y-auto">
          {filteredLeads.map((lead) => (
            <button
              key={lead._id}
              onClick={() => handleSelectLead(lead)}
              className={`w-full text-left px-3 py-3 border-b border-border transition-colors ${
                leadSelecionado?._id === lead._id
                  ? 'bg-primary/5 border-l-2 border-l-primary'
                  : 'hover:bg-muted/50 border-l-2 border-l-transparent'
              }`}
            >
              {lead.atendenteNome && (
                <p className="text-xs text-muted-foreground mb-1 truncate">{lead.atendenteNome}</p>
              )}
              <div className="flex items-start gap-2.5">
                <div className="relative shrink-0">
                  <AvatarInicial nome={lead.nome} size="sm" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-success flex items-center justify-center">
                    <MessageCircle className="h-2 w-2 text-success-foreground" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-foreground truncate">{lead.nome}</span>
                    <TempoRelativo data={lead.ultimaMensagemEm} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.ultimaMensagem}</p>
                </div>
                {lead.naoLidas > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-mono shrink-0">
                    {lead.naoLidas}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Column 2 — Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {leadSelecionado ? (
          <>
            {/* Chat header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-card shrink-0">
              <div className="flex items-center gap-3">
                <AvatarInicial nome={leadSelecionado.nome} size="sm" />
                <div>
                  <h3 className="font-semibold text-sm text-foreground">{leadSelecionado.nome}</h3>
                  <p className="text-xs text-muted-foreground">{leadSelecionado.atendenteNome || 'Não atribuído'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" aria-label="Transferir conversa" className="h-8 w-8">
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-surface-secondary">
              {groupedMessages.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center justify-center my-4">
                    <span className="text-xs text-muted-foreground bg-card px-3 py-1 rounded-full border border-border">
                      {group.date}
                    </span>
                  </div>
                  {group.msgs.map((msg) => (
                    <BolhaMensagem key={msg._id} mensagem={msg} />
                  ))}
                </div>
              ))}
              {digitando && <TypingIndicator nome={leadSelecionado.nome} />}
              <div ref={chatEndRef} />
            </div>

            {/* Gestor bar */}
            {role === 'GESTOR' && (
              <div className="px-4 py-2 bg-gestor-bar border-t border-warning/20 flex items-center gap-2 shrink-0">
                <Shield className="h-4 w-4 text-warning" />
                <span className="text-xs text-warning font-medium mr-2">Supervisão</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    assumirConversa(leadSelecionado._id, user?.nome || 'Gestor');
                    toast.success('Conversa assumida com sucesso');
                  }}
                  aria-label="Assumir conversa"
                >
                  <UserCheck className="h-3 w-3 mr-1" /> Assumir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    enviarMensagem('', 'nota', user?.nome || 'Gestor');
                  }}
                  aria-label="Orientar atendente"
                >
                  Orientar
                </Button>
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setShowRedistribuir(!showRedistribuir)}
                    aria-label="Redistribuir"
                  >
                    <ArrowRightLeft className="h-3 w-3 mr-1" /> Redistribuir
                  </Button>
                  {showRedistribuir && (
                    <div className="absolute bottom-full left-0 mb-1 bg-card border border-border rounded-lg shadow-lg p-2 w-48 z-10">
                      {MOCK_ATENDENTES.filter((a) => a.papel === 'ATENDENTE' && a.status !== 'OFFLINE').map((a) => (
                        <button
                          key={a._id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md flex items-center justify-between"
                          onClick={() => {
                            redistribuirLead(leadSelecionado._id, a.nome);
                            setShowRedistribuir(false);
                            toast.success(`Conversa redistribuída para ${a.nome}`);
                          }}
                        >
                          <span>{a.nome}</span>
                          <span className="text-xs text-muted-foreground">{a.leadsAtivos}/{a.maxLeads}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Composer */}
            <div className="border-t border-border bg-card shrink-0">
              <div className="flex border-b border-border">
                <button
                  onClick={() => setModo('mensagem')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${modo === 'mensagem' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                >
                  Mensagem
                </button>
                <button
                  onClick={() => setModo('nota')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${modo === 'nota' ? 'text-warning border-b-2 border-warning' : 'text-muted-foreground'}`}
                >
                  Anotações internas
                </button>
              </div>
              <div className={`p-3 ${modo === 'nota' ? 'bg-gestor-bar/50' : ''}`}>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={modo === 'nota' ? 'Escreva uma nota interna...' : 'Digite uma mensagem...'}
                      className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-h-[40px] max-h-[120px]"
                      rows={1}
                    />
                    <div className="flex items-center gap-1 mt-1">
                      <button aria-label="Respostas prontas" className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted">
                        <Zap className="h-4 w-4" />
                      </button>
                      <button aria-label="Emoji" className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted">
                        <Smile className="h-4 w-4" />
                      </button>
                      <button aria-label="Anexo" className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted">
                        <Paperclip className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <Button
                    onClick={handleSend}
                    size="icon"
                    disabled={!input.trim()}
                    aria-label="Enviar mensagem"
                    className="h-9 w-9 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <MessageCircle className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Selecione uma conversa para começar</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">Escolha um lead na lista ao lado</p>
          </div>
        )}
      </div>

      {/* Column 3 — Lead info (only when selected) */}
      {leadSelecionado && (
        <div className="w-72 border-l border-border bg-card overflow-y-auto shrink-0 hidden lg:block">
          <div className="p-4 flex flex-col items-center border-b border-border">
            <AvatarInicial nome={leadSelecionado.nome} size="lg" />
            <h3 className="font-semibold text-foreground mt-3">{leadSelecionado.nome}</h3>
            <div className="flex items-center gap-2 mt-2">
              <ScoreBadge value={leadSelecionado.score} />
              <StatusBadge value={leadSelecionado.status} />
            </div>
          </div>

          {/* Contact info */}
          <div className="p-4 border-b border-border space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">Contato</h4>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-success" />
              <span className="text-foreground">{leadSelecionado.telefone}</span>
            </div>
            {leadSelecionado.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-foreground">{leadSelecionado.email}</span>
              </div>
            )}
          </div>

          {/* Qualification */}
          {leadSelecionado.destino && (
            <div className="p-4 border-b border-border space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Qualificação</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Destino:</span>
                  <span className="text-foreground font-medium">{leadSelecionado.destino}</span>
                </div>
                {leadSelecionado.dataPartida && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Partida:</span>
                    <span className="text-foreground">{leadSelecionado.dataPartida}</span>
                  </div>
                )}
                {leadSelecionado.numeroPessoas && (
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Pessoas:</span>
                    <span className="text-foreground">{leadSelecionado.numeroPessoas}</span>
                  </div>
                )}
                {leadSelecionado.orcamento && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Orçamento:</span>
                    <span className="text-foreground font-medium">R$ {leadSelecionado.orcamento.toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lead info */}
          <div className="p-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">Lead info</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Canal</span>
                <span className="text-foreground">{leadSelecionado.canalOrigem === 'META_ADS' ? 'Meta Ads' : leadSelecionado.canalOrigem}</span>
              </div>
              {leadSelecionado.campanha && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campanha</span>
                  <span className="text-foreground">{leadSelecionado.campanha}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Atendente</span>
                <span className="text-foreground">{leadSelecionado.atendenteNome || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
