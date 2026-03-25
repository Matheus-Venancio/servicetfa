import { useMemo } from 'react';

const COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-violet-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500',
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' };

export function AvatarInicial({ nome, size = 'md' }: { nome: string; size?: 'sm' | 'md' | 'lg' }) {
  const colorClass = useMemo(() => COLORS[hashName(nome) % COLORS.length], [nome]);
  const initials = useMemo(() => getInitials(nome), [nome]);

  return (
    <div className={`${sizes[size]} ${colorClass} rounded-full flex items-center justify-center text-primary-foreground font-semibold shrink-0`}>
      {initials}
    </div>
  );
}
