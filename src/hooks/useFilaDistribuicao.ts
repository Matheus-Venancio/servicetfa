import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import {
  consultarEstadoFila,
  processarLeadsAguardando,
  type EstadoFila,
} from '@/services/distribuicaoService'

export function useFilaDistribuicao(autoRefresh = false) {
  const [estado, setEstado] = useState<EstadoFila | null>(null)
  const [loading, setLoading] = useState(true)
  const [leadsAguardando, setLeadsAguardando] = useState(0)

  const carregar = useCallback(async () => {
    setLoading(true)
    const [estadoFila, countResult] = await Promise.all([
      consultarEstadoFila(),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'AGUARDANDO')
        .is('atendente_id', null),
    ])
    setEstado(estadoFila)
    setLeadsAguardando(countResult.count ?? 0)
    setLoading(false)
  }, [])

  // Reprocessa leads aguardando e atualiza o estado da fila
  const reprocessar = useCallback(async () => {
    const distribuidos = await processarLeadsAguardando()
    await carregar()
    return distribuidos
  }, [carregar])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Escuta mudanças na tabela fila_config em tempo real (Supabase Realtime)
  useEffect(() => {
    const channel = supabase
      .channel('fila_config_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'fila_config' },
        () => { carregar() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [carregar])

  // Auto-refresh opcional a cada 30s (útil para o painel do gestor)
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(carregar, 30_000)
    return () => clearInterval(interval)
  }, [autoRefresh, carregar])

  return { estado, loading, leadsAguardando, carregar, reprocessar }
}
