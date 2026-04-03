import { Mensagem } from '@/lib/mockData';
import { format } from 'date-fns';
import { Lock, CheckCheck } from 'lucide-react';

export function BolhaMensagem({ mensagem }: { mensagem: Mensagem }) {
  const hora = format(new Date(mensagem.criadoEm), 'HH:mm');

  if (mensagem.origem === 'NOTA_INTERNA') {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-gestor-bar rounded-lg px-4 py-2 max-w-md shadow-sm">
          <div className="flex items-center gap-1 text-xs text-warning font-medium mb-1">
            <Lock className="h-3 w-3" /> Nota interna
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap">{mensagem.conteudo}</p>
          <span className="text-[11px] text-muted-foreground block text-right mt-1">{hora}</span>
        </div>
      </div>
    );
  }

  const isAtendente = mensagem.origem === 'ATENDENTE';
  const isBot = mensagem.origem === 'BOT';

  // WhatsApp Style Check
  // Lidas = check azul (usaremos text-[#53bdeb])
  return (
    <div className={`flex ${isAtendente ? 'justify-end' : 'justify-start'} my-[2px]`}>
      <div className={`relative max-w-[85%] rounded-lg px-[9px] py-[6px] shadow-sm flex flex-col ${
          isAtendente ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-none' : 
          isBot ? 'bg-[#e2f0fb] text-[#111b21] rounded-tl-none' : 
          'bg-white text-[#111b21] rounded-tl-none'
      }`}>
        {/* Cauda (Tail) */}
        {isAtendente ? (
          <svg viewBox="0 0 8 13" width="8" height="13" className="absolute top-0 right-[-8px] text-[#d9fdd3] fill-current">
            <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z"></path>
          </svg>
        ) : (
          <svg viewBox="0 0 8 13" width="8" height="13" className={`absolute top-0 left-[-8px] ${isBot ? 'text-[#e2f0fb]' : 'text-white'} fill-current`}>
            <path d="M1.533 3.568L8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z"></path>
          </svg>
        )}

        {/* Sender Name if Needed */}
        {isAtendente && mensagem.atendenteNome && (
          <p className="text-[13px] font-medium text-[#027b5b] mb-0.5 leading-tight">{mensagem.atendenteNome}</p>
        )}
        {isBot && <p className="text-[13px] font-medium text-[#1fa855] mb-0.5 leading-tight">🤖 Bot</p>}
        {(!isAtendente && !isBot && mensagem.origem !== 'LEAD') && (
           <p className="text-[13px] font-medium text-[#e53935] mb-0.5 leading-tight">{mensagem.origem}</p>
        )}

        {/* Content */}
        <p className="text-[14px] whitespace-pre-wrap leading-snug">
          {mensagem.conteudo}
          {/* Espaçamento invisível para empurrar o bloco de tempo pro final da linha e não sobrarpor no texto */}
          <span className="inline-block w-12 opacity-0">&#8203;</span>
        </p>

        {/* Time and Checkmarks */}
        <div className="absolute bottom-1 right-2 flex items-center justify-end gap-1">
          <span className="text-[10px] text-[#667781]">{hora}</span>
          {isAtendente && <CheckCheck className="h-[14px] w-[14px] text-[#53bdeb]" />}
        </div>
      </div>
    </div>
  );
}

export function TypingIndicator({ nome }: { nome: string }) {
  return (
    <div className="flex justify-start my-[2px]">
      <div className="relative bg-white rounded-lg rounded-tl-none px-[9px] py-[6px] shadow-sm max-w-[85%]">
        <svg viewBox="0 0 8 13" width="8" height="13" className="absolute top-0 left-[-8px] text-white fill-current">
          <path d="M1.533 3.568L8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z"></path>
        </svg>
        <p className="text-[13px] text-[#667781] mb-1 leading-tight">{nome} está digitando...</p>
        <div className="flex gap-1 pb-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8696a0] animate-typing-dot-1" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#8696a0] animate-typing-dot-2" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#8696a0] animate-typing-dot-3" />
        </div>
      </div>
    </div>
  );
}
