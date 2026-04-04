import { useEffect, useState } from 'react';
import { MOCK_METRICAS, MOCK_ATENDENTES } from '@/lib/mockData';
import { Card } from '@/components/ui/card';
import { TrendingUp, Users, CheckCircle, Percent, Flame } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PainelFila } from '@/components/dashboard/PainelFila';

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.max(1, Math.floor(value / 30));
    const interval = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(interval); }
      else setDisplay(start);
    }, 30);
    return () => clearInterval(interval);
  }, [value]);
  return <span className="font-mono text-3xl font-bold text-foreground animate-count-up">{display}{suffix}</span>;
}

export default function DashboardPage() {
  const m = MOCK_METRICAS;
  const atendentes = MOCK_ATENDENTES.filter((a) => a.papel === 'ATENDENTE');

  const metricCards = [
    { label: 'Leads hoje', value: m.leadsHoje, icon: TrendingUp, sub: '↑ 12 vs ontem' },
    { label: 'Em atendimento', value: m.leadsEmAtendimento, icon: Users, sub: '3 aguardando' },
    { label: 'Fechados hoje', value: m.leadsFechados, icon: CheckCircle, sub: '' },
    { label: 'Taxa conversão', value: m.taxaConversao, icon: Percent, sub: '', suffix: '%' },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Acompanhe sua operação em tempo real</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metricCards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground font-medium">{c.label}</span>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <AnimatedNumber value={c.value} suffix={c.suffix} />
            {c.sub && <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>}
          </Card>
        ))}
      </div>

      <div className="mb-6">
        <PainelFila />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Conversas abertas */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Conversas abertas</h3>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">Em atendimento com humano:</span>
                <span className="font-semibold">{m.leadsEmAtendimento}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-warning" />
                <span className="text-sm text-muted-foreground">Não atribuídas:</span>
                <span className="font-semibold">{m.naoAtribuidas}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-muted" />
                <span className="text-sm text-muted-foreground">Bot/qualificando:</span>
                <span className="font-semibold">0</span>
              </div>
            </div>
            <div className="font-mono text-5xl font-bold text-foreground">
              {m.leadsEmAtendimento + m.naoAtribuidas}
            </div>
          </div>
        </Card>

        {/* Leads por score */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Leads por score</h3>
          <div className="space-y-3">
            {[
              { label: '🔥 Quente', value: m.leadsPorScore.quente, color: 'bg-destructive' },
              { label: '🟡 Morno', value: m.leadsPorScore.morno, color: 'bg-warning' },
              { label: 'Frio', value: m.leadsPorScore.frio, color: 'bg-muted-foreground' },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-semibold">{s.value} leads</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full ${s.color} transition-all duration-500`}
                    style={{ width: `${(s.value / m.leadsHoje) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Tempo médio */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Tempo médio até primeira resposta</h3>
          <div className="flex items-center justify-center gap-4 py-4">
            {[
              { v: m.tempoMedioResposta.horas, l: 'horas' },
              { v: m.tempoMedioResposta.minutos, l: 'minutos' },
              { v: m.tempoMedioResposta.segundos, l: 'segundos' },
            ].map((t, i) => (
              <div key={t.l} className="flex items-center gap-4">
                <div className="text-center">
                  <span className="font-mono text-4xl font-bold text-foreground">{String(t.v).padStart(2, '0')}</span>
                  <p className="text-xs text-muted-foreground mt-1">{t.l}</p>
                </div>
                {i < 2 && <span className="font-mono text-4xl font-bold text-muted-foreground">:</span>}
              </div>
            ))}
          </div>
        </Card>

        {/* Ranking */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Ranking de atendentes</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="pb-2 font-medium">Atendente</th>
                <th className="pb-2 font-medium">Leads ativos</th>
                <th className="pb-2 font-medium">Conversões</th>
                <th className="pb-2 font-medium">Taxa</th>
              </tr>
            </thead>
            <tbody>
              {atendentes.map((a) => (
                <tr key={a._id} className="border-t border-border">
                  <td className="py-2 font-medium text-foreground">{a.nome}</td>
                  <td className="py-2">{a.leadsAtivos}</td>
                  <td className="py-2">{a.conversoes}</td>
                  <td className="py-2 font-mono">{a.leadsAtivos > 0 ? Math.round((a.conversoes / a.leadsAtivos) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Row 4 — Chart */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Evolução semanal</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={m.evolucaoSemanal}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} name="Leads recebidos" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="conversoes" stroke="hsl(var(--success))" strokeWidth={2} name="Conversões" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
