import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_ATENDENTES, MOCK_LEADS, Atendente } from '@/lib/mockData';
import { AvatarInicial } from '@/components/AvatarInicial';
import { StatusDot } from '@/components/StatusDot';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, MessageCircle, TrendingUp, Users, ChevronRight, Headphones } from 'lucide-react';

export default function AtendentesPage() {
  const navigate = useNavigate();
  const [atendentes] = useState<Atendente[]>(MOCK_ATENDENTES.filter((a) => a.papel === 'ATENDENTE'));

  const getLeadsDoAtendente = (nome: string) => {
    return MOCK_LEADS.filter((l) => l.atendenteNome === nome);
  };

  const handleVerConversas = (atendente: Atendente) => {
    navigate(`/gestor/atendentes/${atendente._id}/conversas`);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atendentes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie sua equipe e acompanhe o desempenho</p>
        </div>
        <Button aria-label="Adicionar atendente">
          <Plus className="h-4 w-4 mr-2" /> Adicionar atendente
        </Button>
      </div>

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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {atendentes.map((a) => {
          const cap = (a.leadsAtivos / a.maxLeads) * 100;
          const capColor = cap > 90 ? 'bg-destructive' : cap > 70 ? 'bg-warning' : 'bg-success';
          const leadsAtribuidos = getLeadsDoAtendente(a.nome);
          const naoLidas = leadsAtribuidos.reduce((acc, l) => acc + l.naoLidas, 0);

          return (
            <Card
              key={a._id}
              className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => handleVerConversas(a)}
            >
              {/* Header with status */}
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
                    {naoLidas > 0 && (
                      <span className="bg-destructive text-destructive-foreground text-xs rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center font-mono">
                        {naoLidas}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground capitalize">
                    {a.status === 'ONLINE' ? '🟢 Online' : a.status === 'OCUPADO' ? '🟡 Ocupado' : '⚫ Offline'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{a.email}</p>
                </div>
              </div>

              {/* Stats */}
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

              {/* Capacity bar */}
              <div className="px-5 pb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Capacidade</span>
                  <span className="font-mono">{a.leadsAtivos}/{a.maxLeads}</span>
                </div>
                <div className="h-2 rounded-full bg-muted w-full">
                  <div
                    className={`h-2 rounded-full ${capColor} transition-all`}
                    style={{ width: `${Math.min(cap, 100)}%` }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>{leadsAtribuidos.length} conversas ativas</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all">
                  <span>Ver conversas</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
