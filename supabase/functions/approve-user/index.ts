import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    let solicitacaoId: string | null = null;
    let token: string | null = null;
    const isGet = req.method === 'GET';

    if (isGet) {
      const url = new URL(req.url);
      solicitacaoId = url.searchParams.get('solicitacaoId');
      token = url.searchParams.get('token');
    } else {
      const body = await req.json();
      solicitacaoId = body.solicitacaoId;
      token = body.token;
    }

    if (!solicitacaoId) throw new Error('ID da solicitação é obrigatório.');

    // 1. Busca os dados da solicitação
    const { data: sol, error: fetchError } = await supabaseAdmin
      .from('solicitacoes_acesso')
      .select('*')
      .eq('id', solicitacaoId)
      .single();

    if (fetchError || !sol) throw new Error('Solicitação não encontrada.');
    if (sol.status !== 'PENDENTE') throw new Error('Esta solicitação já foi processada.');
    
    // Se vier do e-mail (ou tiver token no corpo), validamos o token
    if (token && sol.approval_token !== token) {
      throw new Error('Token de aprovação inválido.');
    }

    // 2. Cria o usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: sol.email,
      password: sol.senha,
      email_confirm: true,
      user_metadata: { nome: sol.nome, telefone: sol.telefone }
    });

    if (authError) throw authError;

    // 3. Cria o perfil na tabela de atendentes
    const { error: profileError } = await supabaseAdmin
      .from('atendentes')
      .upsert({
        id: authData.user.id,
        nome: sol.nome,
        email: sol.email,
        telefone: sol.telefone,
        papel: 'GESTOR',
        aprovado: true,
        status: 'OFFLINE'
      });

    if (profileError) throw profileError;

    // 4. Marca solicitação como aprovada
    await supabaseAdmin
      .from('solicitacoes_acesso')
      .update({ status: 'APROVADO' })
      .eq('id', solicitacaoId);

    // 5. Notifica o Gerente por e-mail
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'TFA Viagens <onboarding@resend.dev>',
          to: [sol.email],
          subject: 'Bem-vindo! Seu acesso à TFA Viagens foi liberado',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
              <h2 style="color: #0f766e;">Olá, ${sol.nome}!</h2>
              <p>Boas notícias! Seu acesso como <strong>Gerente</strong> na plataforma TFA Connect foi aprovado.</p>
              <p>Você já pode utilizar seu e-mail e a senha cadastrada para entrar no sistema.</p>
              <div style="margin: 32px 0; text-align: center;">
                <a href="https://connect-tfa.vercel.app/login" style="background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  ACESSAR O SISTEMA
                </a>
              </div>
              <p style="font-size: 12px; color: #777;">TFA Viagens - Atendimento Inteligente</p>
            </div>
          `,
        }),
      });
    }

    if (isGet) {
      return new Response(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc;">
            <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h1 style="color: #0f766e;">Acesso Aprovado!</h1>
              <p style="color: #475569;">A conta de ${sol.nome} foi criada e ele recebeu um e-mail de confirmação.</p>
              <p style="margin-top: 20px;"><small>Você pode fechar esta aba agora.</small></p>
            </div>
          </body>
        </html>
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response(JSON.stringify({ ok: true, userId: authData.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[ApproveUser] Erro:', msg);
    
    if (req.method === 'GET') {
      return new Response(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #fef2f2;">
            <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; border: 1px solid #fee2e2;">
              <h1 style="color: #991b1b;">Erro na Aprovação</h1>
              <p style="color: #7f1d1d;">${msg}</p>
            </div>
          </body>
        </html>
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }, status: 400 });
    }

    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
