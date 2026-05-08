import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!resendApiKey) throw new Error("RESEND_API_KEY não configurada.");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase keys ausentes.");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Identificar viagens que estão a 7 dias de distância
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + 7);
    const targetDateString = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD

    const { data: viagens, error: viagensError } = await supabase
      .from("viagens")
      .select(`
        id,
        destino,
        data_partida,
        lead:leads(nome),
        atendente:atendentes(nome, email)
      `)
      .eq("data_partida", targetDateString)
      .eq("status", "AGENDADA");

    if (viagensError) {
      throw new Error(`Erro ao buscar viagens: ${viagensError.message}`);
    }

    if (!viagens || viagens.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma viagem próxima encontrada para notificar hoje." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    let enviados = 0;
    let falhas = 0;

    for (const viagem of viagens) {
      const atendente = viagem.atendente as any;
      const lead = viagem.lead as any;

      if (!atendente || !atendente.email) {
        falhas++;
        continue;
      }

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0c9e9a;">Lembrete de Viagem Próxima! ✈️</h2>
          <p>Olá <strong>${atendente.nome}</strong>,</p>
          <p>A viagem do seu cliente <strong>${lead?.nome || 'Desconhecido'}</strong> para <strong>${viagem.destino}</strong> está se aproximando.</p>
          <p><strong>Data de Partida:</strong> ${new Date(viagem.data_partida).toLocaleDateString('pt-BR')}</p>
          <p>Recomendamos entrar em contato com o cliente para enviar vouchers e repassar as últimas orientações.</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">Este é um e-mail automático do sistema TFA Viagens.</p>
        </div>
      `;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "TFA Viagens <onboarding@resend.dev>", // Pode precisar de um domínio validado no Resend
            to: [atendente.email],
            subject: `🚨 Viagem Próxima: Cliente ${lead?.nome || ''}`,
            html: emailHtml,
          }),
        });

        if (res.ok) {
          enviados++;
        } else {
          console.error("Falha ao enviar email via Resend:", await res.text());
          falhas++;
        }
      } catch (err) {
        console.error("Erro na request do Resend:", err);
        falhas++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: "Notificações processadas", 
        enviados, 
        falhas, 
        total: viagens.length 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in notify-upcoming-trips:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
