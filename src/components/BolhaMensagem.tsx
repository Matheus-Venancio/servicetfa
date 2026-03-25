import { Mensagem } from '@/lib/mockData';
import { format } from 'date-fns';
import { Lock, Check, CheckCheck } from 'lucide-react';

export function BolhaMensagem({ mensagem }: { mensagem: Mensagem }) {
  const hora = format(new Date(mensagem.criadoEm), 'HH:mm');

  if (mensagem.origem === 'NOTA_INTERNA') {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-gestor-bar rounded-lg px-4 py-2 max-w-md">
          <div className="flex items-center gap-1 text-xs text-warning font-medium mb-1">
            <Lock className="h-3 w-3" /> Nota interna
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap">{mensagem.conteudo}</p>
          <span className="text-xs text-muted-foreground block text-right mt-1">{hora}</span>
        </div>
      </div>
    );
  }

  const isAtendente = mensagem.origem === 'ATENDENTE';
  const isBot = mensagem.origem === 'BOT';

  return (
    <div className={`flex ${isAtendente ? 'justify-end' : 'justify-start'} my-1`}>
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 ${
          isAtendente
            ? 'bg-primary/5 border border-primary/10'
            : isBot
            ? 'bg-info/5 border border-info/10'
            : 'bg-muted'
        }`}
      >
        {isAtendente && mensagem.atendenteNome && (
          <p className="text-xs font-semibold text-primary mb-1">{mensagem.atendenteNome}</p>
        )}
        {isBot && <p className="text-xs font-semibold text-info mb-1">🤖 Bot</p>}
        <p className="text-sm text-foreground whitespace-pre-wrap">{mensagem.conteudo}</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-xs text-muted-foreground font-mono">{hora}</span>
          {isAtendente && <CheckCheck className="h-3 w-3 text-primary" />}
        </div>
      </div>
    </div>
  );
}

export function TypingIndicator({ nome }: { nome: string }) {
  return (
    <div className="flex justify-start my-1">
      <div className="bg-muted rounded-lg px-4 py-3">
        <p className="text-xs text-muted-foreground mb-1">{nome} está digitando...</p>
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-typing-dot-1" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-typing-dot-2" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-typing-dot-3" />
        </div>
      </div>
    </div>
  );
}
