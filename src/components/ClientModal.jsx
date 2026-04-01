import { useState, useEffect } from 'react'
import { API_URL } from '../aws-config'

const NIVEIS       = ['Nível 1 - Acima de 50K','Nível 2 - Entre 10k e 50K','Nível 3 - Entre 5K e 10K','Nível 4 - Abaixo de 5K']
const RESPONSAVEIS = ['Felipe Gomes','Rafael Santiago','N/A']

const fmt    = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0)
const fmtBRL = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0)
const fmtMes = (mesAno) => {
  const [ano, mes] = mesAno.split('-')
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${nomes[parseInt(mes)-1]}/${ano.slice(2)}`
}

async function getToken() {
  try {
    const { Auth } = await import('aws-amplify')
    const session = await Auth.currentSession()
    return session.getIdToken().getJwtToken()
  } catch(e) {
    console.error('Auth error:', e)
    return null
  }
}

// ── Billing Chart ─────────────────────────────────────────────
function BillingChart({ clienteNome }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [hover,   setHover]   = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : {}
        console.log('[Billing] fetching for:', clienteNome)
        const res = await fetch(
          `${API_URL}/billing/${encodeURIComponent(clienteNome)}`,
          { headers }
        )
        console.log('[Billing] status:', res.status)
        const json = await res.json()
        console.log('[Billing] items:', json.count)
        setData((json.items || []).sort((a, b) => a.mesAno.localeCompare(b.mesAno)))
      } catch(e) {
        console.error('[Billing] error:', e)
        setData([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [clienteNome])

  if (loading) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
      Carregando histórico...
    </div>
  )

  if (!data || data.length === 0) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
      Nenhum histórico de faturamento encontrado.
    </div>
  )

  const maxVal = Math.max(...data.map(d => d.consumo_usd || 0))
  const HEIGHT = 120
  const BAR_W  = Math.max(14, Math.min(36, Math.floor(580 / data.length) - 4))
  const GAP    = Math.max(2, Math.floor(580 / data.length) - BAR_W)
  const last12 = data.slice(-12)
  const avg12  = last12.reduce((s, d) => s + (d.consumo_usd || 0), 0) / (last12.length || 1)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Último mês',     value: fmt(data[data.length-1]?.consumo_usd), sub: data[data.length-1]?.mesAno },
          { label: 'Média 12 meses', value: fmt(avg12),  sub: 'consumo médio' },
          { label: 'Pico histórico', value: fmt(maxVal), sub: data.find(d => d.consumo_usd === maxVal)?.mesAno },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface3)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, color: 'var(--accent)', fontWeight: 500 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: GAP, minWidth: data.length * (BAR_W + GAP), paddingTop: 24 }}>
          {data.map((d, i) => {
            const h       = maxVal > 0 ? Math.max(4, (d.consumo_usd / maxVal) * HEIGHT) : 4
            const isHover = hover === i
            const isLast  = i === data.length - 1
            return (
              <div key={d.mesAno} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', position: 'relative' }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {isHover && (
                  <div style={{
                    position: 'absolute', bottom: '100%', left: '50%',
                    transform: 'translateX(-50%)', marginBottom: 6,
                    background: 'var(--surface)', border: '1px solid var(--border2)',
                    borderRadius: 8, padding: '8px 12px', fontSize: 12,
                    whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  }}>
                    <div style={{ fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{fmtMes(d.mesAno)}</div>
                    <div style={{ color: 'var(--accent)' }}>{fmt(d.consumo_usd)}</div>
                    {d.valor_nf_brl > 0 && <div style={{ color: 'var(--muted)', marginTop: 2 }}>{fmtBRL(d.valor_nf_brl)}</div>}
                    {d.cotacao > 0 && <div style={{ color: 'var(--muted)' }}>R$ {d.cotacao.toFixed(4)}</div>}
                  </div>
                )}
                <div style={{
                  width: BAR_W, height: h,
                  background: isHover ? '#00f0c0' : isLast ? 'var(--accent)' : 'rgba(0,212,170,0.3)',
                  borderRadius: '4px 4px 2px 2px', transition: 'background 0.15s',
                }} />
                <div style={{
                  fontSize: 9, color: isHover ? 'var(--text)' : 'var(--muted)',
                  fontFamily: 'DM Mono, monospace',
                  transform: 'rotate(-45deg)', whiteSpace: 'nowrap', marginTop: 2,
                }}>{fmtMes(d.mesAno)}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Últimos 6 meses
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {['Mês','Consumo AWS','NF (BRL)','Cotação'].map(h => (
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

function Input({ label, name, value, onChange, type = 'text' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</label>
      <input name={name} value={value} onChange={onChange} type={type}
        style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e  => e.target.style.borderColor = 'var(--border2)'}
      />
    </div>
  )
}

function Select({ label, name, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</label>
      <select name={name} value={value} onChange={onChange}
        style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', outline: 'none' }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export default function ClientModal({ client, onClose, onSaved }) {
  const isNew  = !client?.id
  const [tab,  setTab]  = useState('dados')
  const [form, setForm] = useState({
    nome:'', razaoSocial:'', cnpj:'', ativo:'Sim', consumo: 0,
    responsavel:'Felipe Gomes', nivel: NIVEIS[3], amCliente:'',
    acessoConta:'Individual', contaPayer:'', dashBI:'Sem Acesso',
    cms:'Não', pls:'Não', envioFatura:'Padrão', simplesNacional:'Não',
    ...client,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.nome.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true); setError('')
    try {
      const token = await getToken()
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
      const method = isNew ? 'POST' : 'PUT'
      const url    = isNew ? `${API_URL}/clients` : `${API_URL}/clients/${client.id}`
      const res = await fetch(url, { method, headers, body: JSON.stringify(form) })
      if (!res.ok) throw new Error('Erro ao salvar')
      onSaved()
    } catch { setError('Erro ao salvar. Tente novamente.') }
    finally { setSaving(false) }
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }
  const modal   = { background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '92vh', overflowY: 'auto' }
  const body    = { padding: '0 24px 24px' }
  const footer  = { padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', bottom: 0, background: 'var(--surface)' }
  const grid2   = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }
  const secTit  = { fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, marginTop: 20 }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ padding: '24px 24px 0', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700 }}>
                {isNew ? 'Novo Cliente' : client.nome}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                {isNew ? 'Preencha os dados' : client.razaoSocial || '—'}
              </div>
              {!isNew && (
                <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
                  {[{id:'dados',label:'Dados'},{id:'historico',label:'Histórico de Consumo'}].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                      padding: '7px 16px', borderRadius: '8px 8px 0 0', border: 'none',
                      fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                      background: tab === t.id ? 'var(--surface2)' : 'transparent',
                      color:      tab === t.id ? 'var(--accent)'   : 'var(--muted)',
                      borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                    }}>{t.label}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexShrink: 0, marginLeft: 12 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div style={{ height: 1, background: 'var(--border)', marginTop: 0 }} />
        </div>

        <div style={body}>
          {(tab === 'dados' || isNew) && (
            <>
              <div style={secTit}>Identificação</div>
              <div style={grid2}>
                <Input label="Nome / Apelido *" name="nome" value={form.nome} onChange={handleChange} />
                <Input label="Razão Social" name="razaoSocial" value={form.razaoSocial} onChange={handleChange} />
                <Input label="CNPJ" name="cnpj" value={form.cnpj} onChange={handleChange} />
                <Input label="Conta Payer AWS" name="contaPayer" value={form.contaPayer} onChange={handleChange} />
              </div>
              <div style={secTit}>Classificação & Consumo</div>
              <div style={grid2}>
                <Select label="Status" name="ativo" value={form.ativo} onChange={handleChange} options={['Sim','Não']} />
                <Input label="Consumo médio / mês (USD)" name="consumo" value={form.consumo} onChange={handleChange} type="number" />
                <Select label="Nível" name="nivel" value={form.nivel} onChange={handleChange} options={NIVEIS} />
                <Select label="Simples Nacional" name="simplesNacional" value={form.simplesNacional} onChange={handleChange} options={['Sim','Não']} />
                <Select label="Envio de Fatura" name="envioFatura" value={form.envioFatura} onChange={handleChange} options={['Padrão','Data Corte - dia 10']} />
              </div>
              <div style={secTit}>Relacionamento</div>
              <div style={grid2}>
                <Select label="Responsável" name="responsavel" value={form.responsavel} onChange={handleChange} options={RESPONSAVEIS} />
                <Input label="AM do Cliente" name="amCliente" value={form.amCliente} onChange={handleChange} />
                <Select label="Acesso à Conta" name="acessoConta" value={form.acessoConta} onChange={handleChange} options={['Individual','Solvimm','Sem Acesso']} />
                <Select label="Dashboard BI" name="dashBI" value={form.dashBI} onChange={handleChange} options={['Sem Acesso','Liberar','Acessando']} />
              </div>
              <div style={secTit}>Serviços</div>
              <div style={{ ...grid2, gridTemplateColumns: '1fr 1fr 1fr' }}>
                <Select label="CMS" name="cms" value={form.cms} onChange={handleChange} options={['Sim','Não']} />
                <Select label="PLS" name="pls" value={form.pls} onChange={handleChange} options={['Sim','Não']} />
              </div>
            </>
          )}
          {tab === 'historico' && !isNew && (
            <div style={{ paddingTop: 20 }}>
              <BillingChart clienteNome={client.nome} />
            </div>
          )}
        </div>

        <div style={footer}>
          <div style={{ fontSize: 13, color: 'var(--accent4)' }}>{error}</div>
          {(tab === 'dados' || isNew) ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 18px', fontSize: 13, fontWeight: 600, color: '#000', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif' }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          ) : (
            <button onClick={onClose} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Fechar</button>
          )}
        </div>
      </div>
    </div>
  )
}
