import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '../services/api.js'
import Topbar from '../components/Topbar.jsx'

const fmt    = v => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct = v => `${v > 0 ? '+' : ''}${Number(v || 0).toFixed(1)}%`
const fmtDate = s => {
  const [, m, d] = s.split('-')
  return `${d}/${m}`
}

const STATUS_COLOR = { green: 'var(--accent)', yellow: 'var(--accent3)', red: 'var(--accent4)' }
const STATUS_LABEL = { green: '🟢 Normal', yellow: '🟡 Atenção', red: '🔴 Anomalia' }

const SERVICE_COLORS = [
  '#00BEC8','#0096DC','#00d4aa','#f59e0b','#ef4444',
  '#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899',
]

function getTopServices(chartData, n = 8) {
  const totals = {}
  for (const day of chartData) {
    for (const [svc, cost] of Object.entries(day.services || {})) {
      totals[svc] = (totals[svc] || 0) + cost
    }
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([svc]) => svc)
}

export default function Semanal() {
  const [clients,   setClients]   = useState([])
  const [clientId,  setClientId]  = useState('')
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [copied,    setCopied]    = useState(false)

  useEffect(() => {
    api.listClients().then(r => {
      const weekly = (r.items || []).filter(c => c.weeklyReport && c.ativo === 'Sim')
      setClients(weekly)
      if (weekly.length > 0) setClientId(weekly[0].id)
    })
  }, [])

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    setData(null)
    api.getWeeklyReport(clientId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [clientId])

  function handleCopy() {
    if (!data?.ticketText) return
    navigator.clipboard.writeText(data.ticketText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const card  = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:24 }
  const title = { fontFamily:'Syne, sans-serif', fontSize:14, fontWeight:600, marginBottom:16 }
  const th    = { padding:'10px 16px', textAlign:'left', fontSize:11, fontFamily:'DM Mono, monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:500 }
  const td    = { padding:'12px 16px', fontSize:13, borderTop:'1px solid var(--border)', verticalAlign:'middle' }

  const topServices = data ? getTopServices(data.chartData) : []

  return (
    <div>
      <Topbar title="Acompanhamento Semanal" actions={
        <select
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          style={{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)', padding:'9px 14px', fontSize:13, color:'var(--text)', fontFamily:'DM Sans, sans-serif', outline:'none', cursor:'pointer', minWidth:200 }}
        >
          {clients.length === 0 && <option value="">Nenhum cliente habilitado</option>}
          {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      } />

      <div style={{ padding:'28px 32px', display:'flex', flexDirection:'column', gap:24 }}>

        {/* Tabela semana atual */}
        <div style={card}>
          <div style={title}>Semana Atual — Últimos 7 dias</div>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--muted)', fontSize:13 }}>Carregando...</div>
          ) : !data || data.weekDays.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--muted)', fontSize:13 }}>
              {clients.length === 0 ? 'Nenhum cliente com Weekly Report habilitado.' : 'Sem dados para este cliente. Execute o sync primeiro.'}
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ background:'var(--surface2)' }}>
                <tr>
                  {['Data','Total do dia','Variação vs média','Status'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.weekDays.map(day => (
                  <tr key={day.data}>
                    <td style={{ ...td, fontFamily:'DM Mono, monospace' }}>{fmtDate(day.data)}</td>
                    <td style={{ ...td, fontFamily:'DM Mono, monospace', color:'var(--accent)' }}>{fmt(day.totalCost)}</td>
                    <td style={{ ...td, fontFamily:'DM Mono, monospace', color: day.variacao_pct > 10 ? STATUS_COLOR[day.status] : 'var(--muted)' }}>
                      {fmtPct(day.variacao_pct)}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize:12, color: STATUS_COLOR[day.status] }}>
                        {STATUS_LABEL[day.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Gráfico 35 dias */}
        {data && data.chartData.length > 0 && (
          <div style={card}>
            <div style={title}>Histórico — Últimas 5 semanas</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.chartData} margin={{ top:4, right:8, left:8, bottom:24 }}>
                <XAxis dataKey="data" tickFormatter={fmtDate} tick={{ fontSize:10, fill:'var(--muted)', fontFamily:'DM Mono, monospace' }} interval={6} />
                <YAxis tick={{ fontSize:10, fill:'var(--muted)', fontFamily:'DM Mono, monospace' }} tickFormatter={v => `$${v}`} />
                <Tooltip
                  formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name]}
                  labelFormatter={fmtDate}
                  contentStyle={{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:8, fontSize:12 }}
                />
                <Legend wrapperStyle={{ fontSize:11, fontFamily:'DM Mono, monospace' }} />
                {topServices.map((svc, i) => (
                  <Bar key={svc} dataKey={entry => (entry.services || {})[svc] || 0} name={svc} stackId="a"
                    fill={SERVICE_COLORS[i % SERVICE_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Card anomalias */}
        {data && (
          <div style={card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={title}>
                {data.anomalies.length === 0
                  ? '🟢 Nenhuma anomalia detectada'
                  : `🔴 ${data.anomalies.length} anomalia${data.anomalies.length > 1 ? 's' : ''} detectada${data.anomalies.length > 1 ? 's' : ''}`
                }
              </div>
              <button
                onClick={handleCopy}
                style={{ background: copied ? 'var(--accent)' : 'var(--surface2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)', padding:'8px 16px', fontSize:12, color: copied ? '#000' : 'var(--text)', cursor:'pointer', fontFamily:'DM Mono, monospace', transition:'all 0.2s' }}
              >
                {copied ? '✓ Copiado!' : 'Copiar texto do ticket'}
              </button>
            </div>

            {data.anomalies.length > 0 && (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead style={{ background:'var(--surface2)' }}>
                  <tr>
                    {['Serviço','Média atual/dia','Média baseline/dia','Variação'].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.anomalies.map(a => (
                    <tr key={a.service}>
                      <td style={td}>{a.service}</td>
                      <td style={{ ...td, fontFamily:'DM Mono, monospace', color:'var(--accent4)' }}>{fmt(a.media_atual)}</td>
                      <td style={{ ...td, fontFamily:'DM Mono, monospace', color:'var(--muted)' }}>{fmt(a.media_baseline)}</td>
                      <td style={{ ...td, fontFamily:'DM Mono, monospace', color:'var(--accent4)', fontWeight:600 }}>
                        +{a.variacao_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
