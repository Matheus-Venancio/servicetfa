import { supabase } from '@/integrations/supabase/client'
import type { Atendente } from '@/integrations/supabase/types'

// ─── Resultado de uma distribuição ───────────────────────────────────────────
export interface ResultadoDistribuicao {
  sucesso: boolean
  atendente: Atendente | null
  motivo?: 'sem_atendentes_online' | 'capacidade_cheia' | 'erro_interno'
}

// ─── Resultado de uma consulta do estado da fila ──────────────────────────────
export interface EstadoFila {
  ultimoIdx: number
  totalOnline: number
  proximoAtendente: Atendente | null
  atendentesOnline: Atendente[]
}

// ─────────────────────────────────────────────────────────────────────────────
// distribuirLead
// Chama a função proxima_da_fila() no Supabase (que é atômica e thread-safe)
// e retorna o atendente que deve receber o próximo lead.
// ─────────────────────────────────────────────────────────────────────────────
export async function distribuirLead(): Promise<ResultadoDistribuicao> {
  try {
    // Chama a função PostgreSQL que implementa o round-robin atomicamente
    const { data: atendenteId, error: rpcError } = await supabase
      .rpc('proxima_da_fila')

    if (rpcError) {
      console.error('[Distribuição] Erro na função proxima_da_fila:', rpcError)
      return { sucesso: false, atendente: null, motivo: 'erro_interno' }
    }

    // Função retornou null → nenhum atendente online disponível
    if (!atendenteId) {
      return { sucesso: false, atendente: null, motivo: 'sem_atendentes_online' }
    }

    // Busca dados completos do atendente selecionado
    const { data: atendente, error: fetchError } = await supabase
      .from('atendentes')
      .select('*')
      .eq('id', atendenteId)
      .single()

    if (fetchError || !atendente) {
      console.error('[Distribuição] Erro ao buscar atendente:', fetchError)
      return { sucesso: false, atendente: null, motivo: 'erro_interno' }
    }

    // Verifica capacidade: conta leads ativos deste atendente
    const { count } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('atendente_id', atendenteId)
      .in('status', ['EM_ATENDIMENTO', 'QUALIFICANDO', 'AGUARDANDO', 'PROPOSTA_ENVIADA'])

    if ((count ?? 0) >= atendente.max_leads) {
      return { sucesso: false, atendente, motivo: 'capacidade_cheia' }
    }

    return { sucesso: true, atendente }

  } catch (err) {
    console.error('[Distribuição] Erro inesperado:', err)
    return { sucesso: false, atendente: null, motivo: 'erro_interno' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// atribuirLeadAoAtendente
// Atribui um lead existente a um atendente específico (usado também
// para redistribuição manual pelo gestor).
// ─────────────────────────────────────────────────────────────────────────────
export async function atribuirLeadAoAtendente(
  leadId: string,
  atendenteId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('leads')
    .update({
      atendente_id: atendenteId,
      status: 'EM_ATENDIMENTO',
    })
    .eq('id', leadId)

  if (error) {
    console.error('[Distribuição] Erro ao atribuir lead:', error)
    return false
  }

  // Registra evento de atribuição nas mensagens (nota de sistema)
  await supabase.from('mensagens').insert({
    lead_id: leadId,
    atendente_id: atendenteId,
    origem: 'SISTEMA',
    tipo: 'SISTEMA',
    conteudo: 'Lead atribuído via sistema de distribuição automática.',
  })

  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// criarEDistribuirLead
// Fluxo completo: cria o lead no banco e já distribui para o próximo
// atendente da fila. Retorna o lead criado com o atendente atribuído.
// ─────────────────────────────────────────────────────────────────────────────
export async function criarEDistribuirLead(dadosLead: {
  telefone: string
  nome?: string
  canal_origem?: Lead['canal_origem']
  utm_source?: string
  utm_campaign?: string
  pagina_origem?: string
  primeira_mensagem?: string
}): Promise<{ leadId: string; atendenteId: string | null; atendente: Atendente | null }> {

  // 1. Descobre quem vai receber (antes de criar, para já salvar atribuído)
  const distribuicao = await distribuirLead()

  // 2. Cria o lead já com o atendente (ou AGUARDANDO se ninguém online)
  const { data: novoLead, error } = await supabase
    .from('leads')
    .insert({
      telefone: dadosLead.telefone,
      nome: dadosLead.nome ?? null,
      canal_origem: dadosLead.canal_origem ?? 'META_ADS',
      utm_source: dadosLead.utm_source ?? null,
      utm_campaign: dadosLead.utm_campaign ?? null,
      pagina_origem: dadosLead.pagina_origem ?? null,
      atendente_id: distribuicao.atendente?.id ?? null,
      status: distribuicao.sucesso ? 'EM_ATENDIMENTO' : 'AGUARDANDO',
      score: 'FRIO',
    })
    .select()
    .single()

  if (error || !novoLead) {
    throw new Error(`Erro ao criar lead: ${error?.message}`)
  }

  // 3. Registra a primeira mensagem se existir
  if (dadosLead.primeira_mensagem) {
    await supabase.from('mensagens').insert({
      lead_id: novoLead.id,
      origem: 'LEAD',
      tipo: 'TEXTO',
      conteudo: dadosLead.primeira_mensagem,
    })
  }

  // 4. Mensagem de sistema informando a distribuição
  if (distribuicao.sucesso && distribuicao.atendente) {
    await supabase.from('mensagens').insert({
      lead_id: novoLead.id,
      origem: 'SISTEMA',
      tipo: 'SISTEMA',
      conteudo: `Lead distribuído automaticamente para ${distribuicao.atendente.nome} via fila round-robin.`,
    })
  } else {
    await supabase.from('mensagens').insert({
      lead_id: novoLead.id,
      origem: 'SISTEMA',
      tipo: 'SISTEMA',
      conteudo: `Nenhum atendente disponível no momento. Lead em fila de espera (${distribuicao.motivo}).`,
    })
  }

  return {
    leadId: novoLead.id,
    atendenteId: distribuicao.atendente?.id ?? null,
    atendente: distribuicao.atendente,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// consultarEstadoFila
// Retorna o estado atual da fila para exibir no painel do gestor.
// ─────────────────────────────────────────────────────────────────────────────
export async function consultarEstadoFila(): Promise<EstadoFila> {
  const [filaResult, atendentesResult] = await Promise.all([
    supabase.from('fila_config').select('ultimo_idx').eq('id', 'singleton').single(),
    supabase
      .from('atendentes')
      .select('*')
      .eq('status', 'ONLINE')
      .eq('papel', 'ATENDENTE')
      .order('nome', { ascending: true }),
  ])

  const ultimoIdx = filaResult.data ? filaResult.data.ultimo_idx : 0
  const atendentesOnline = atendentesResult.data ?? []
  const total = atendentesOnline.length

  const proximoIdx = total > 0 ? ultimoIdx % total : 0
  const proximoAtendente = atendentesOnline[proximoIdx] ?? null

  return {
    ultimoIdx,
    totalOnline: total,
    proximoAtendente,
    atendentesOnline,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// redistribuirLeadManual
// Usado pelo gestor para reatribuir manualmente um lead a outro atendente.
// ─────────────────────────────────────────────────────────────────────────────
export async function redistribuirLeadManual(
  leadId: string,
  novoAtendenteId: string,
  gestorId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('leads')
    .update({ atendente_id: novoAtendenteId, status: 'EM_ATENDIMENTO' })
    .eq('id', leadId)

  if (error) return false

  // Registra nota interna de redistribuição
  await supabase.from('notas_internas').insert({
    lead_id: leadId,
    atendente_id: gestorId,
    conteudo: 'Lead redistribuído manualmente pelo gestor.',
  })

  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// processarLeadsAguardando
// Roda periodicamente e tenta distribuir leads que ficaram AGUARDANDO
// porque não havia atendentes online quando chegaram.
// ─────────────────────────────────────────────────────────────────────────────
export async function processarLeadsAguardando(): Promise<number> {
  const { data: leadsAguardando } = await supabase
    .from('leads')
    .select('id')
    .eq('status', 'AGUARDANDO')
    .is('atendente_id', null)
    .order('criado_em', { ascending: true })
    .limit(10)

  if (!leadsAguardando?.length) return 0

  let distribuidos = 0

  for (const lead of leadsAguardando) {
    const distribuicao = await distribuirLead()
    if (!distribuicao.sucesso || !distribuicao.atendente) break // ninguém mais disponível

    const ok = await atribuirLeadAoAtendente(lead.id, distribuicao.atendente.id)
    if (ok) distribuidos++
  }

  return distribuidos
}

// Re-exporta o tipo Lead para conveniência
import type { Lead } from '@/integrations/supabase/types'
