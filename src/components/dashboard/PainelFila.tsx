import { useFilaDistribuicao } from '@/hooks/useFilaDistribuicao'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Users, ArrowRight, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export function PainelFila() {
  const { estado, loading, leadsAguardando, carregar, reprocessar } = useFilaDistribuicao(true)

  const handleReprocessar = async () => {
    const n = await reprocessar()
    if (n > 0) toast.success(`${n} lead(s) distribuído(s) com sucesso!`)
    else toast.info('Nenhum lead aguardando ou sem atendentes disponíveis.')
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando estado da fila...</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Fila de Distribuição
        </h3>
        <Button size="sm" variant="outline" onClick={carregar}>
          <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
        </Button>
      </div>

      {/* Próximo da fila */}
      {estado?.proximoAtendente ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
          <ArrowRight className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Próximo lead vai para</p>
            <p className="font-semibold text-foreground">{estado.proximoAtendente.nome}</p>
          </div>
          <Badge variant="outline" className="ml-auto text-xs">
            {estado.totalOnline} online
          </Badge>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20 mb-4">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive font-medium">Nenhum atendente online</p>
        </div>
      )}

      {/* Lista de atendentes online na ordem da fila */}
      {estado && estado.atendentesOnline.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Ordem da fila (A-Z)
          </p>
          {estado.atendentesOnline.map((atendente, idx) => (
            <div
              key={atendente.id}
              className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                atendente.id === estado.proximoAtendente?.id
                  ? 'bg-primary/10 font-medium'
                  : 'bg-muted/30'
              }`}
            >
              <span className="text-xs text-muted-foreground w-5 text-center">{idx + 1}</span>
              <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
              <span className="flex-1">{atendente.nome}</span>
              {atendente.id === estado.proximoAtendente?.id && (
                <Badge className="text-xs">próximo</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Leads aguardando */}
      {leadsAguardando > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-warning">
              {leadsAguardando} lead(s) aguardando atendente
            </span>
          </div>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleReprocessar}>
            Distribuir agora
          </Button>
        </div>
      )}
    </Card>
  )
}
