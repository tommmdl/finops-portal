import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '../services/api.js'
import Topbar from '../components/Topbar.jsx'

const fmt     = v => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct  = v => `${v > 0 ? '+' : ''}${Number(v || 0).toFixed(1)}%`
const fmtDate = s => { const [, m, d] = s.split('-'); return `${d}/${m}` }

// Thresholds para highlight de linha (mais generosos que o badge de status)
function rowStyle(variacao_pct) {
  const v = Math.abs(variacao_pct)
  if (v > 50) return { background: 'rgba(239,68,68,0.08)', borderLeft: '3px solid var(--accent4)' }
  if (v > 20) return { background: 'rgba(245,158,11,0.08)', borderLeft: '3px solid var(--accent3)' }
  return { borderLeft: '3px solid transparent' }
}

const STATUS_COLOR = { green: 'var(--accent)', yellow: 'var(--accent3)', red: 'var(--accent4)' }
const STATUS_LABEL = { green: '🟢 Normal', yellow: '🟡 Atenção', red: '🔴 Anomalia' }

const SERVICE_COLORS = [
  '#00BEC8','#0096DC','#00d4aa','#f59e0b','#ef4444',
  '#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899',
]

function getTopServices(chartData, n = 8) {
  const totals = {}
  for (const day of chartData)
    for (const [svc, cost] of Object.entries(day.services || {}))
      totals[svc] = (totals[svc] || 0) + cost
  return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, n).map(([s]) => s)
}

// Calcula breakdown por serviço para um dia específico vs baseline (mês anterior)
function serviceBreakdown(dayData, baselineData) {
  if (!dayData || !baselineData || baselineData.length === 0) return []

  // Exclude day 01 (SP/RI upfront + consolidated Tax distort per-service means)
  const baselineClean = baselineData.filter(d => !d.data.endsWith('-01'))
  const baseSrc = baselineClean.length > 0 ? baselineClean : baselineData

  const services = new Set([
    ...Object.keys(dayData.services || {}),
    ...baseSrc.flatMap(d => Object.keys(d.services || {})),
  ])

  const rows = []
  for (const svc of services) {
    const dayCost = dayData.services?.[svc] || 0
    const baselineCosts = baseSrc.map(d => d.services?.[svc] || 0)
    const baselineMean = baselineCosts.reduce((a, b) => a + b, 0) / baselineCosts.length
    if (dayCost === 0 && baselineMean < 0.01) continue
    const variacao = baselineMean > 0 ? (dayCost - baselineMean) / baselineMean * 100 : null
    rows.push({ svc, dayCost, baselineMean, variacao })
  }

  return rows.sort((a, b) => Math.abs(b.variacao ?? 0) - Math.abs(a.variacao ?? 0))
}

export default function Semanal() {
  const [clients,     setClients]     = useState([])
  const [clientId,    setClientId]    = useState('')
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [expandedDay, setExpandedDay] = useState(null)

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
    setExpandedDay(null)
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

  function toggleDay(date) {
    setExpandedDay(prev => prev === date ? null : date)
  }

  const card  = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:24 }
  const title = { fontFamily:'Syne, sans-serif', fontSize:14, fontWeight:600, marginBottom:16 }
  const th    = { padding:'10px 16px', textAlign:'left', fontSize:11, fontFamily:'DM Mono, monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:500 }
  const td    = { padding:'12px 16px', fontSize:13, borderTop:'1px solid var(--border)', verticalAlign:'middle' }

  const topServices = data ? getTopServices(data.chartData) : []

  // Pré-computa baseline mean por dia usando mês anterior (baselineData).
  // Exclui dia 01: cobranças upfront de SP/RI e Tax consolidada distorcem a média.
  const baselineMeanByDate = {}
  if (data?.baselineData?.length > 0) {
    const baselineClean = data.baselineData.filter(d => !d.data.endsWith('-01'))
    const baseSrc = baselineClean.length > 0 ? baselineClean : data.baselineData
    const mean = baseSrc.reduce((s, d) => s + (d.totalCost || 0), 0) / baseSrc.length
    data.weekDays.forEach(d => { baselineMeanByDate[d.data] = mean })
  }

  const baselineLabel = data?.baselineMonthLabel ?? 'Mês Anterior'

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
                  {['','Data','Total do dia',`Média ${baselineLabel}/dia`,'Variação','Status'].map((h, i) => (
                    <th key={i} style={{ ...th, width: i === 0 ? 28 : undefined }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.weekDays.map(day => {
                  const isOpen   = expandedDay === day.data
                  const baseline = baselineMeanByDate[day.data] ?? 0
                  const dayChart = data.chartData.find(d => d.data === day.data)
                  const breakdown = isOpen ? serviceBreakdown(dayChart, data.baselineData) : []

                  return [
                    <tr
                      key={day.data}
                      onClick={() => toggleDay(day.data)}
                      style={{ cursor:'pointer', ...rowStyle(day.variacao_pct), transition:'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
                      onMouseLeave={e => e.currentTarget.style.filter = ''}
                    >
                      {/* chevron */}
                      <td style={{ ...td, padding:'12px 8px 12px 16px', color:'var(--muted)', fontSize:10 }}>
                        {isOpen ? '▼' : '▶'}
                      </td>
                      <td style={{ ...td, fontFamily:'DM Mono, monospace', fontWeight:500 }}>{fmtDate(day.data)}</td>
                      <td style={{ ...td, fontFamily:'DM Mono, monospace', color:'var(--accent)' }}>{fmt(day.totalCost)}</td>
                      <td style={{ ...td, fontFamily:'DM Mono, monospace', color:'var(--muted)' }}>{fmt(baseline)}</td>
                      <td style={{ ...td, fontFamily:'DM Mono, monospace', color: Math.abs(day.variacao_pct) > 20 ? STATUS_COLOR[day.status] : 'var(--muted)', fontWeight: Math.abs(day.variacao_pct) > 20 ? 600 : 400 }}>
                        {fmtPct(day.variacao_pct)}
                      </td>
                      <td style={td}>
                        <span style={{ fontSize:12, color: STATUS_COLOR[day.status] }}>
                          {STATUS_LABEL[day.status]}
                        </span>
                      </td>
                    </tr>,

                    isOpen && (
                      <tr key={`${day.data}-breakdown`}>
                        <td colSpan={6} style={{ padding:0, background:'var(--surface2)', borderTop:'1px solid var(--border)' }}>
                          <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <thead>
                              <tr>
                                {['Serviço','Custo do dia',`Média ${baselineLabel}`,'Variação'].map(h => (
                                  <th key={h} style={{ ...th, padding:'8px 20px', background:'var(--surface2)', fontSize:10 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {breakdown.map(row => {
                                const isAnomaly = row.variacao !== null && row.variacao > 20
                                const color = isAnomaly ? 'var(--accent4)' : row.variacao !== null && row.variacao > 0 ? 'var(--accent3)' : 'var(--muted)'
                                return (
                                  <tr key={row.svc} style={{ background: isAnomaly ? 'rgba(239,68,68,0.06)' : '' }}>
                                    <td style={{ ...td, padding:'9px 20px', fontWeight: isAnomaly ? 500 : 400 }}>{row.svc}</td>
                                    <td style={{ ...td, padding:'9px 20px', fontFamily:'DM Mono, monospace', color:'var(--accent)' }}>{fmt(row.dayCost)}</td>
                                    <td style={{ ...td, padding:'9px 20px', fontFamily:'DM Mono, monospace', color:'var(--muted)' }}>{fmt(row.baselineMean)}</td>
                                    <td style={{ ...td, padding:'9px 20px', fontFamily:'DM Mono, monospace', color, fontWeight: isAnomaly ? 600 : 400 }}>
                                      {row.variacao !== null ? fmtPct(row.variacao) : '—'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ),
                  ]
                })}
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
                    {['Serviço','Média atual/dia',`Média ${baselineLabel}/dia`,'Variação'].map(h => (
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
