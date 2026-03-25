export function StatusDot({ status }: { status: 'ONLINE' | 'OCUPADO' | 'OFFLINE' }) {
  const colors = {
    ONLINE: 'bg-success animate-pulse-dot',
    OCUPADO: 'bg-warning',
    OFFLINE: 'bg-muted-foreground/50',
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />;
}
