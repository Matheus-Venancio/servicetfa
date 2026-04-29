import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Tratar requisição CORS preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY não configurada no Edge Function.');
    }

    const { email, nome, token, tipo } = await req.json();

    if (!email || !token) {
      throw new Error('E-mail e Token são obrigatórios.');
    }

    const appUrl = Deno.env.get('FRONTEND_URL') || req.headers.get('origin') || 'http://localhost:5173';
    const linkAssinatura = `${appUrl}/assinatura/${token}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #2b3a4a;">Olá, ${nome || 'Cliente'}!</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          Seu contrato de viagem <strong>${tipo}</strong> com a TFA Viagens está pronto para assinatura.
        </p>
        <p style="color: #4a5568; line-height: 1.6;">
          Para garantir sua segurança, o processo é 100% digital. Por favor, acesse o link seguro abaixo para ler os termos e assinar eletronicamente:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${linkAssinatura}" style="background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Ler e Assinar Contrato
          </a>
        </div>
        <p style="color: #718096; font-size: 12px; margin-top: 30px; text-align: center;">
          Este é um e-mail automático enviado pelo sistema de gestão da TFA Viagens.
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'TFA Viagens <contato@resend.dev>', // Alterar depois para o domínio real verificado no resend
        to: [email],
        subject: 'Ação Necessária: Assinatura do seu Contrato de Viagem',
        html: htmlContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Erro do Resend: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
