import { useState } from 'react';
import { MOCK_ATENDENTES, Atendente } from '@/lib/mockData';
import { AvatarInicial } from '@/components/AvatarInicial';
import { StatusDot } from '@/components/StatusDot';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function AtendentesPage() {
  const [atendentes] = useState<Atendente[]>(MOCK_ATENDENTES.filter((a) => a.papel === 'ATENDENTE'));

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Atendentes</h1>
        <Button aria-label="Adicionar atendente">
          <Plus className="h-4 w-4 mr-2" /> Adicionar atendente
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {atendentes.map((a) => {
          const cap = (a.leadsAtivos / a.maxLeads) * 100;
          const capColor = cap > 90 ? 'bg-destructive' : cap > 70 ? 'bg-warning' : 'bg-success';
          return (
            <Card key={a._id} className="p-5 flex flex-col items-center text-center">
              <div className="flex items-center gap-2 self-start mb-3">
                <StatusDot status={a.status} />
                <span className="text-xs text-muted-foreground capitalize">
                  {a.status === 'ONLINE' ? 'Online' : a.status === 'OCUPADO' ? 'Ocupado' : 'Offline'}
                </span>
              </div>
              <AvatarInicial nome={a.nome} size="lg" />
              <h3 className="font-semibold text-foreground mt-3">{a.nome}</h3>
              <p className="text-sm text-muted-foreground">Atendente</p>

              <div className="w-full mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Leads ativos</span>
                  <span className="font-semibold">{a.leadsAtivos}</span>
                </div>
                <div className="h-2 rounded-full bg-muted w-full">
                  <div
                    className={`h-2 rounded-full ${capColor} transition-all`}
                    style={{ width: `${cap}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">{a.leadsAtivos}/{a.maxLeads}</p>
              </div>

              <div className="flex justify-between text-sm w-full mt-3 pt-3 border-t border-border">
                <span className="text-muted-foreground">Conversões</span>
                <span className="font-semibold">
                  {a.conversoes} ({a.leadsAtivos > 0 ? Math.round((a.conversoes / a.leadsAtivos) * 100) : 0}%)
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
