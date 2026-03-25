import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_ATENDENTES } from '@/lib/mockData';
import { AvatarInicial } from '@/components/AvatarInicial';
import { StatusDot } from '@/components/StatusDot';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import ConversasPage from './ConversasPage';

export default function AtendenteConversasPage() {
  const { atendenteId } = useParams();
  const navigate = useNavigate();

  const atendente = useMemo(() => {
    return MOCK_ATENDENTES.find((a) => a._id === atendenteId);
  }, [atendenteId]);

  if (!atendente) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Atendente não encontrado</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header bar with attendant info */}
      <div className="h-12 px-4 flex items-center gap-3 border-b border-border bg-card shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate('/gestor/atendentes')}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="relative">
          <AvatarInicial nome={atendente.nome} size="sm" />
          <span className="absolute -bottom-0.5 -right-0.5">
            <StatusDot status={atendente.status} />
          </span>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{atendente.nome}</h2>
          <p className="text-xs text-muted-foreground">
            {atendente.leadsAtivos} leads ativos · {atendente.conversoes} conversões
          </p>
        </div>
      </div>

      {/* Reuse ConversasPage filtered by this attendant */}
      <div className="flex-1 overflow-hidden">
        <ConversasPage role="GESTOR" filterByAtendente={atendente.nome} />
      </div>
    </div>
  );
}
