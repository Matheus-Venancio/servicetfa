import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Lead, Atendente } from '@/integrations/supabase/types'

export interface MetricasAtendente {
  id: string
  nome: string
  email: string
  status: Atendente['status']
  max_leads: number
  leadsAtivos: number
  conversoes: number
}

export interface EvolucaoDia {
  dia: string
  leads: number
  conversoes: number
}

export interface DashboardMetricas {
  // KPIs principais
  leadsHoje: number
  leadsEmAtendimento: number
  leadsFechados: number
  taxaConversao: number

  // Conversas abertas
  naoAtribuidas: number
  qualificando: number

  // Leads por score
  leadsPorScore: { quente: number; morno: number; frio: number }

  // Receita (viagens)
  receitaTotal: number
  viagensAgendadas: number
  viagensConcluidas: number

  // Canal de origem
  leadsPorCanal: { canal: string; total: number }[]

  // Evolução semanal
  evolucaoSemanal: EvolucaoDia[]

  // Ranking de atendentes (com métricas reais)
  atendentes: MetricasAtendente[]
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function formatarDia(dateStr: string): string {
  const d = new Date(dateStr)
  return DIAS_SEMANA[d.getDay()]
}

function dataInicioHoje(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function dataNDiasAtras(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function useDashboardMetricas() {
  const [metricas, setMetricas] = useState<DashboardMetricas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const hoje = dataInicioHoje()
      const semanaAtras = dataNDiasAtras(6)

      // ── Todas as queries em paralelo ─────────────────────────────────────────
      const [
        leadsResult,
        leadsSemanaResult,
        atendentesResult,
        viagensResult,
      ] = await Promise.all([
        // 1. Todos os leads (status + score + canal + atendente_id)
        supabase
          .from('leads')
          .select('id, status, score, canal_origem, atendente_id, criado_em, atualizado_em'),

        // 2. Leads dos últimos 7 dias para evolução semanal
        supabase
          .from('leads')
          .select('criado_em, status, atualizado_em')
          .gte('criado_em', semanaAtras),

        // 3. Atendentes (apenas ATENDENTEs)
        supabase
          .from('atendentes')
          .select('id, nome, email, status, max_leads')
          .eq('papel', 'ATENDENTE'),

        // 4. Viagens para métricas financeiras
        supabase
          .from('viagens')
          .select('id, status, valor_investimento'),
      ])

      // ── Processar leads ──────────────────────────────────────────────────────
      const leads = (leadsResult.data ?? []) as Pick<
        Lead,
        'id' | 'status' | 'score' | 'canal_origem' | 'atendente_id' | 'criado_em' | 'atualizado_em'
      >[]

      const leadsHoje = leads.filter((l) => l.criado_em >= hoje).length

      const leadsEmAtendimento = leads.filter((l) => l.status === 'EM_ATENDIMENTO').length

      const leadsFechadosHoje = leads.filter(
        (l) => l.status === 'FECHADO' && l.atualizado_em >= hoje,
      ).length

      const totalLeads = leads.length
      const totalFechados = leads.filter((l) => l.status === 'FECHADO').length
      const taxaConversao =
        totalLeads > 0 ? Math.round((totalFechados / totalLeads) * 1000) / 10 : 0

      const naoAtribuidas = leads.filter(
        (l) => l.status === 'AGUARDANDO' && !l.atendente_id,
      ).length

      const qualificando = leads.filter(
        (l) => l.status === 'QUALIFICANDO' || l.status === 'NOVO',
      ).length

      // Score
      const quente = leads.filter((l) => l.score === 'QUENTE').length
      const morno = leads.filter((l) => l.score === 'MORNO').length
      const frio = leads.filter((l) => l.score === 'FRIO').length

      // Canal de origem
      const canalMap: Record<string, number> = {}
      for (const l of leads) {
        canalMap[l.canal_origem] = (canalMap[l.canal_origem] ?? 0) + 1
      }
      const leadsPorCanal = Object.entries(canalMap)
        .map(([canal, total]) => ({ canal, total }))
        .sort((a, b) => b.total - a.total)

      // ── Evolução semanal (últimos 7 dias, agrupado no client) ────────────────
      const leadsSemanais = (leadsSemanaResult.data ?? []) as Pick<
        Lead,
        'criado_em' | 'status' | 'atualizado_em'
      >[]

      const evolucaoMap: Record<string, { leads: number; conversoes: number }> = {}

      // Inicializa os últimos 7 dias
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        evolucaoMap[key] = { leads: 0, conversoes: 0 }
      }

      for (const l of leadsSemanais) {
        const keyLead = l.criado_em.slice(0, 10)
        if (evolucaoMap[keyLead]) evolucaoMap[keyLead].leads += 1

        if (l.status === 'FECHADO') {
          const keyFech = l.atualizado_em.slice(0, 10)
          if (evolucaoMap[keyFech]) evolucaoMap[keyFech].conversoes += 1
        }
      }

      const evolucaoSemanal: EvolucaoDia[] = Object.entries(evolucaoMap).map(
        ([dateKey, v]) => ({
          dia: DIAS_SEMANA[new Date(dateKey + 'T12:00:00').getDay()],
          leads: v.leads,
          conversoes: v.conversoes,
        }),
      )

      // ── Contagens reais por atendente ────────────────────────────────────────
      const atendentes = (atendentesResult.data ?? []) as Pick<
        Atendente,
        'id' | 'nome' | 'email' | 'status' | 'max_leads'
      >[]

      const metricasAtendentes: MetricasAtendente[] = atendentes.map((a) => {
        const mLeads = leads.filter(
          (l) => l.atendente_id === a.id && l.status === 'EM_ATENDIMENTO',
        ).length
        const mConversoes = leads.filter(
          (l) => l.atendente_id === a.id && l.status === 'FECHADO',
        ).length
        return {
          id: a.id,
          nome: a.nome,
          email: a.email,
          status: a.status,
          max_leads: a.max_leads,
          leadsAtivos: mLeads,
          conversoes: mConversoes,
        }
      })

      // ── Viagens ─────────────────────────────────────────────────────────────
      const viagens = (viagensResult.data ?? []) as { id: string; status: string; valor_investimento: number | null }[]

      const receitaTotal = viagens
        .filter((v) => v.status === 'CONCLUIDA' || v.status === 'AGENDADA')
        .reduce((acc, v) => acc + (v.valor_investimento ?? 0), 0)

      const viagensAgendadas = viagens.filter((v) => v.status === 'AGENDADA').length
      const viagensConcluidas = viagens.filter((v) => v.status === 'CONCLUIDA').length

      // ── Montar objeto final ──────────────────────────────────────────────────
      setMetricas({
        leadsHoje,
        leadsEmAtendimento,
        leadsFechados: leadsFechadosHoje,
        taxaConversao,
        naoAtribuidas,
        qualificando,
        leadsPorScore: { quente, morno, frio },
        receitaTotal,
        viagensAgendadas,
        viagensConcluidas,
        leadsPorCanal,
        evolucaoSemanal,
        atendentes: metricasAtendentes,
      })
    } catch (e: any) {
      console.error('[useDashboardMetricas] Erro:', e)
      setError(e?.message ?? 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Realtime: atualiza quando leads mudam
  useEffect(() => {
    const channel = supabase
      .channel('dashboard_leads_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        carregar()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viagens' }, () => {
        carregar()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [carregar])

  return { metricas, loading, error, carregar }
}
