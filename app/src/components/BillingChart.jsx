import { useState, useEffect } from 'react'
import { fetchAuthSession } from 'aws-amplify/auth'
import { API_URL } from '../aws-config'

const fmt    = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0)
const fmtBRL = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0)

async function fetchBilling(clienteNome) {
  const session = await fetchAuthSession()
  const token   = session.tokens?.idToken?.toString()
  const res = await fetch(
    `${API_URL}/billing/${encodeURIComponent(clienteNome)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.items || []).sort((a, b) => a.mesAno.localeCompare(b.mesAno))
}

export default function BillingChart({ clienteNome }) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [hover,   setHover]   = useState(null)

  useEffect(() => {
    if (!clienteNome) return
    fetchBilling(clienteNome)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [clienteNome])

  if (loading) return (
    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
      Carregando histórico...
    </div>
  )

  if (data.length === 0) return (
    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
      Nenhum histórico de faturamento encontrado.
    </div>
  )

  const maxVal  = Math.max(...data.map(d => d.consumo_usd || 0))
  const HEIGHT  = 120
  const BAR_W   = Math.max(16, Math.min(40, Math.floor(560 / data.length) - 4))
  const GAP     = Math.max(3, Math.floor(560 / data.length) - BAR_W)

  // Formata mes/ano para exibição
  const fmtMes = (mesAno) => {
    const [ano, mes] = mesAno.split('-')
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${nomes[parseInt(mes)-1]}/${ano.slice(2)}`
  }

  // Últimos 12 meses em destaque
  const last12 = data.slice(-12)
  const avg12  = last12.reduce((s, d) => s + (d.consumo_usd || 0), 0) / last12.length

  return (
    <div>
      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Último mês', value: fmt(data[data.length-1]?.consumo_usd), sub: data[data.length-1]?.mesAno },
          { label: 'Média 12 meses', value: fmt(avg12), sub: 'consumo médio' },
          { label: 'Pico histórico', value: fmt(maxVal), sub: data.find(d => d.consumo_usd === maxVal)?.mesAno },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface3)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, color: 'var(--accent)', fontWeight: 500 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Gráfico de barras */}
      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: GAP, minWidth: data.length * (BAR_W + GAP), paddingTop: 8 }}>
          {data.map((d, i) => {
            const h = maxVal > 0 ? Math.max(4, (d.consumo_usd / maxVal) * HEIGHT) : 4
            const isHover = hover === i
            const isLast  = i === data.length - 1
            return (
              <div key={d.mesAno} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {/* Tooltip */}
                {isHover && (
                  <div style={{
                    position: 'absolute', transform: 'translateY(-100%) translateX(-50%)',
                    background: 'var(--surface)', border: '1px solid var(--border2)',
                    borderRadius: 8, padding: '8px 12px', fontSize: 12, whiteSpace: 'nowrap',
                    zIndex: 10, pointerEvents: 'none', marginTop: -8,
                  }}>
                    <div style={{ fontWeight: 500, color: 'var(--text)' }}>{fmtMes(d.mesAno)}</div>
                    <div style={{ color: 'var(--accent)' }}>{fmt(d.consumo_usd)}</div>
                    {d.valor_nf_brl > 0 && <div style={{ color: 'var(--muted)' }}>{fmtBRL(d.valor_nf_brl)}</div>}
                    {d.cotacao > 0 && <div style={{ color: 'var(--muted)' }}>R$ {d.cotacao.toFixed(4)}</div>}
                  </div>
                )}
                {/* Barra */}
                <div style={{
                  width: BAR_W, height: h,
                  background: isHover ? '#00f0c0' : isLast ? 'var(--accent)' : 'rgba(0,212,170,0.35)',
                  borderRadius: '4px 4px 2px 2px',
                  transition: 'background 0.15s, height 0.3s',
                  position: 'relative',
                }} />
                {/* Label mês */}
                <div style={{
                  fontSize: 9, color: isHover ? 'var(--text)' : 'var(--muted)',
                  fontFamily: 'DM Mono, monospace', transform: 'rotate(-45deg)',
                  whiteSpace: 'nowrap', marginTop: 2,
                }}>
                  {fmtMes(d.mesAno)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabela resumo últimos 6 meses */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Últimos 6 meses
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {['Mês', 'Consumo AWS', 'NF (BRL)', 'Cotação'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(-6).reverse().map(d => (
              <tr key={d.mesAno} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 12px', fontFamily: 'DM Mono, monospace' }}>{fmtMes(d.mesAno)}</td>
                <td style={{ padding: '8px 12px', color: 'var(--accent)', fontFamily: 'DM Mono, monospace' }}>{fmt(d.consumo_usd)}</td>
                <td style={{ padding: '8px 12px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{d.valor_nf_brl > 0 ? fmtBRL(d.valor_nf_brl) : '—'}</td>
                <td style={{ padding: '8px 12px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{d.cotacao > 0 ? `R$ ${d.cotacao.toFixed(4)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
