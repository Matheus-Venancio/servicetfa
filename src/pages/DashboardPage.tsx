import { useEffect, useState } from 'react';
import { useDashboardMetricas } from '@/hooks/useDashboardMetricas';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, Users, CheckCircle, Percent, DollarSign,
  RefreshCw, Loader2, AlertCircle, FileCheck, FileClock,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, Cell,
} from 'recharts';
import { PainelFila } from '@/components/dashboard/PainelFila';

// ── Contador animado ─────────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    let start = 0;
    const step = Math.max(1, Math.floor(value / 30));
    const interval = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(interval); }
      else setDisplay(start);
    }, 30);
    return () => clearInterval(interval);
  }, [value]);
  return <span className="font-mono text-3xl font-bold text-foreground">{display}{suffix}</span>;
}

// ── Labels legíveis para canal de origem ────────────────────────────────────
const CANAL_LABEL: Record<string, string> = {
  META_ADS: 'Meta Ads',
  GOOGLE_ADS: 'Google Ads',
  TIKTOK_ADS: 'TikTok Ads',
  ORGANICO: 'Orgânico',
  INDICACAO: 'Indicação',
  OUTRO: 'Outro',
};

const CANAL_COLORS: Record<string, string> = {
  META_ADS: '#3b82f6',
  GOOGLE_ADS: '#f59e0b',
  TIKTOK_ADS: '#ec4899',
  ORGANICO: '#10b981',
  INDICACAO: '#8b5cf6',
  OUTRO: '#6b7280',
};

// ── Formatação de moeda ──────────────────────────────────────────────────────
function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function DashboardPage() {
  const { metricas: m, loading, error, carregar } = useDashboardMetricas();

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const metricCards = m
    ? [
        {
          label: 'Leads hoje',
          value: m.leadsHoje,
          icon: TrendingUp,
          sub: `${m.leadsHoje} recebidos desde meia-noite`,
          color: 'text-primary',
          bg: 'bg-primary/10',
        },
        {
          label: 'Em atendimento',
          value: m.leadsEmAtendimento,
          icon: Users,
          sub: `${m.naoAtribuidas} aguardando atribuição`,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10',
        },
        {
          label: 'Fechados hoje',
          value: m.leadsFechados,
          icon: CheckCircle,
          sub: `${m.contratosAssinados} contratos assinados`,
          color: 'text-green-500',
          bg: 'bg-green-500/10',
        },
        {
          label: 'Taxa de conversão',
          value: m.taxaConversao,
          icon: Percent,
          sub: 'Leads fechados / total',
          suffix: '%',
          color: 'text-yellow-500',
          bg: 'bg-yellow-500/10',
        },
      ]
    : [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Acompanhe sua operação em tempo real
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={carregar}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-4 mb-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Erro ao carregar métricas: {error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !m && (
        <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando métricas...</span>
        </div>
      )}

      {m && (
        <>
          {/* ── KPI Cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {metricCards.map((c) => (
              <Card key={c.label} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground font-medium">{c.label}</span>
                  <div className={`h-8 w-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                    <c.icon className={`h-4 w-4 ${c.color}`} />
                  </div>
                </div>
                <AnimatedNumber value={c.value} suffix={c.suffix} />
                {c.sub && <p className="text-xs text-muted-foreground mt-1.5">{c.sub}</p>}
              </Card>
            ))}
          </div>

          {/* ── Receita (contratos) ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="p-5 col-span-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground font-medium">Receita (contratos)</span>
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              <span className="font-mono text-2xl font-bold text-foreground">
                {formatBRL(m.receitaTotal)}
              </span>
              <p className="text-xs text-muted-foreground mt-1.5">Assinados + Faturados</p>
            </Card>

            <Card className="p-5 col-span-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground font-medium">Contratos assinados</span>
                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <FileCheck className="h-4 w-4 text-green-500" />
                </div>
              </div>
              <span className="font-mono text-3xl font-bold text-foreground">
                {m.contratosAssinados}
              </span>
              <p className="text-xs text-muted-foreground mt-1.5">Assinados / faturados</p>
            </Card>

            <Card className="p-5 col-span-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground font-medium">Aguardando assinatura</span>
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <FileClock className="h-4 w-4 text-orange-500" />
                </div>
              </div>
              <span className="font-mono text-3xl font-bold text-foreground">
                {m.contratosPendentes}
              </span>
              <p className="text-xs text-muted-foreground mt-1.5">Gerados / enviados</p>
            </Card>
          </div>

          {/* ── Fila de distribuição (já era real) ──────────────────────── */}
          <div className="mb-6">
            <PainelFila />
          </div>

          {/* ── Conversas abertas + Leads por score ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Conversas abertas */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Conversas abertas</h3>
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-3">
                  {[
                    {
                      label: 'Em atendimento humano',
                      value: m.leadsEmAtendimento,
                      color: 'bg-primary',
                    },
                    {
                      label: 'Não atribuídas',
                      value: m.naoAtribuidas,
                      color: 'bg-orange-400',
                    },
                    {
                      label: 'Bot / qualificando',
                      value: m.qualificando,
                      color: 'bg-muted-foreground',
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${item.color}`} />
                      <span className="text-sm text-muted-foreground">{item.label}:</span>
                      <span className="font-semibold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="font-mono text-5xl font-bold text-foreground">
                  {m.leadsEmAtendimento + m.naoAtribuidas + m.qualificando}
                </div>
              </div>
            </Card>

            {/* Leads por score */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Leads por temperatura</h3>
              <div className="space-y-3">
                {[
                  { label: '🔥 Quente', value: m.leadsPorScore.quente, color: 'bg-red-500' },
                  { label: '🌡️ Morno', value: m.leadsPorScore.morno, color: 'bg-yellow-500' },
                  { label: '❄️ Frio', value: m.leadsPorScore.frio, color: 'bg-blue-400' },
                ].map((s) => {
                  const total = m.leadsPorScore.quente + m.leadsPorScore.morno + m.leadsPorScore.frio;
                  const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                  return (
                    <div key={s.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="font-semibold text-foreground">
                          {s.value} leads <span className="text-muted-foreground font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className={`h-2 rounded-full ${s.color} transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* ── Ranking de atendentes ────────────────────────────────────── */}
          <Card className="p-5 mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Ranking de atendentes</h3>
            {m.atendentes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum atendente cadastrado
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="pb-3 font-medium">Atendente</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Leads ativos</th>
                    <th className="pb-3 font-medium">Conversões</th>
                    <th className="pb-3 font-medium">Taxa</th>
                    <th className="pb-3 font-medium">Capacidade</th>
                  </tr>
                </thead>
                <tbody>
                  {[...m.atendentes]
                    .sort((a, b) => b.conversoes - a.conversoes)
                    .map((a) => {
                      const cap = a.max_leads > 0 ? Math.round((a.leadsAtivos / a.max_leads) * 100) : 0;
                      const capColor =
                        cap > 90 ? 'bg-destructive' : cap > 70 ? 'bg-yellow-500' : 'bg-green-500';
                      const taxa =
                        (a.leadsAtivos + a.conversoes) > 0
                          ? Math.round((a.conversoes / (a.leadsAtivos + a.conversoes)) * 100)
                          : 0;
                      return (
                        <tr key={a.id} className="border-t border-border">
                          <td className="py-3 font-medium text-foreground">{a.nome}</td>
                          <td className="py-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                a.status === 'ONLINE'
                                  ? 'bg-green-500/10 text-green-600'
                                  : a.status === 'OCUPADO'
                                  ? 'bg-yellow-500/10 text-yellow-600'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {a.status === 'ONLINE' ? '🟢' : a.status === 'OCUPADO' ? '🟡' : '⚫'}{' '}
                              {a.status}
                            </span>
                          </td>
                          <td className="py-3">{a.leadsAtivos}</td>
                          <td className="py-3">{a.conversoes}</td>
                          <td className="py-3 font-mono">{taxa}%</td>
                          <td className="py-3 w-32">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted">
                                <div
                                  className={`h-1.5 rounded-full ${capColor} transition-all`}
                                  style={{ width: `${Math.min(cap, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                                {a.leadsAtivos}/{a.max_leads}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </Card>

          {/* ── Evolução semanal + Canal de origem ──────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Evolução semanal — ocupa 2/3 */}
            <Card className="p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-foreground mb-4">Evolução semanal</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={m.evolucaoSemanal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="dia"
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="leads"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      name="Leads recebidos"
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="conversoes"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Conversões"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Canal de origem — ocupa 1/3 */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Leads por canal</h3>
              {m.leadsPorCanal.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum dado disponível
                </p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={m.leadsPorCanal.map((c) => ({
                        canal: CANAL_LABEL[c.canal] ?? c.canal,
                        total: c.total,
                        key: c.canal,
                      }))}
                      layout="vertical"
                      margin={{ left: 4, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                        allowDecimals={false}
                      />
                      <YAxis
                        dataKey="canal"
                        type="category"
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                        width={72}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="total" name="Leads" radius={[0, 4, 4, 0]}>
                        {m.leadsPorCanal.map((c) => (
                          <Cell
                            key={c.canal}
                            fill={CANAL_COLORS[c.canal] ?? '#6b7280'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
