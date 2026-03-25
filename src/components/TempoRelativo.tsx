import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function TempoRelativo({ data }: { data: string }) {
  const date = new Date(data);
  let text: string;
  if (isToday(date)) {
    text = formatDistanceToNow(date, { locale: ptBR, addSuffix: false });
  } else if (isYesterday(date)) {
    text = 'ontem';
  } else {
    text = format(date, 'dd/MM', { locale: ptBR });
  }
  return <span className="text-xs text-muted-foreground font-mono">{text}</span>;
}

export function formatarDataSeparador(data: string): string {
  const date = new Date(data);
  if (isToday(date)) return 'HOJE';
  if (isYesterday(date)) return 'ONTEM';
  return format(date, "dd 'DE' MMMM 'DE' yyyy", { locale: ptBR }).toUpperCase();
}
