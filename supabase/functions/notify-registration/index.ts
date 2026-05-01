import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ADMIN_EMAIL = 'matheusvecordeiro@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY não configurada.');
    }

    const { nome, email, telefone, solicitacaoId, token } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://bnofeyrcvvlaweoryisw.supabase.co';
    const approveLink = `${supabaseUrl}/functions/v1/approve-user?solicitacaoId=${solicitacaoId}&token=${token}`;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #0f766e;">Novo Pedido de Acesso - TFA Connect</h2>
        <p>Um novo gerente solicitou acesso ao sistema:</p>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Nome:</strong> ${nome}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Telefone:</strong> ${telefone}</li>
        </ul>
        
        <div style="margin: 32px 0; text-align: center;">
          <a href="${approveLink}" style="background-color: #0f766e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            APROVAR ACESSO AGORA
          </a>
        </div>

        <p style="font-size: 14px; color: #555;">
          Ao clicar no botão acima, a conta do gerente será criada automaticamente e ele receberá um e-mail de confirmação.
        </p>
        
        <div style="margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; font-size: 12px; color: #777; text-align: center;">
          TFA Viagens - Sistema de Gestão
        </div>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'TFA Connect <onboarding@resend.dev>',
        to: [ADMIN_EMAIL],
        subject: `Novo Cadastro Pendente: ${nome}`,
        html: htmlContent,
      }),
    });

    const data = await res.json();

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
