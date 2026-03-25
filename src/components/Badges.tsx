export function ScoreBadge({ value }: { value: 'QUENTE' | 'MORNO' | 'FRIO' }) {
  const config = {
    QUENTE: { bg: 'bg-score-quente-bg', text: 'text-score-quente-text', label: '🔥 Quente' },
    MORNO: { bg: 'bg-score-morno-bg', text: 'text-score-morno-text', label: '🟡 Morno' },
    FRIO: { bg: 'bg-score-frio-bg', text: 'text-score-frio-text', label: 'Frio' },
  };
  const c = config[value];
  return <span className={`${c.bg} ${c.text} text-xs font-medium px-2 py-0.5 rounded-full`}>{c.label}</span>;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  NOVO: { bg: 'bg-info/10', text: 'text-info', label: 'Novo' },
  QUALIFICANDO: { bg: 'bg-warning/10', text: 'text-warning', label: 'Qualificando' },
  EM_ATENDIMENTO: { bg: 'bg-primary/10', text: 'text-primary', label: 'Em atendimento' },
  PROPOSTA_ENVIADA: { bg: 'bg-success/10', text: 'text-success', label: 'Proposta enviada' },
  FECHADO: { bg: 'bg-success/10', text: 'text-success', label: 'Fechado' },
  PERDIDO: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Perdido' },
};

export function StatusBadge({ value }: { value: string }) {
  const c = STATUS_CONFIG[value] || STATUS_CONFIG.NOVO;
  return <span className={`${c.bg} ${c.text} text-xs font-medium px-2 py-0.5 rounded-full`}>{c.label}</span>;
}
