import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api.js'
import Topbar, { Btn } from '../components/Topbar.jsx'
import ClientModal from '../components/ClientModal.jsx'

const fmt = v => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v||0)

function Badge({ children, color }) {
  const colors = {
    green:  { background:'rgba(0,212,170,0.12)',  color:'var(--accent)' },
    red:    { background:'rgba(239,68,68,0.12)',  color:'var(--accent4)' },
    blue:   { background:'rgba(14,165,233,0.12)', color:'var(--accent2)' },
    amber:  { background:'rgba(245,158,11,0.12)', color:'var(--accent3)' },
    gray:   { background:'rgba(107,114,128,0.15)',color:'var(--muted)' },
  }
  return <span style={{ ...colors[color]||colors.gray, display:'inline-flex', alignItems:'center', padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:500, fontFamily:'DM Mono, monospace', whiteSpace:'nowrap' }}>{children}</span>
}

function nivelBadge(n) {
  if (!n) return <Badge color="gray">—</Badge>
  if (n.includes('1')) return <Badge color="green">N1</Badge>
  if (n.includes('2')) return <Badge color="blue">N2</Badge>
  if (n.includes('3')) return <Badge color="amber">N3</Badge>
  return <Badge color="gray">N4</Badge>
}

function dashBadge(d) {
  if (d === 'Acessando') return <Badge color="green">Acessando</Badge>
  if (d === 'Liberar')   return <Badge color="amber">Liberar</Badge>
  return <Badge color="gray">{d || '—'}</Badge>
}

const PER_PAGE = 12

export default function Clients() {
  const [clients,  setClients]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null)   // null | {} (new) | client object
  const [search,   setSearch]   = useState('')
  const [fStatus,  setFStatus]  = useState('')
  const [fNivel,   setFNivel]   = useState('')
  const [fResp,    setFResp]    = useState('')
  const [page,     setPage]     = useState(1)
  const [toast,    setToast]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.listClients()
      setClients(r.items || [])
    } catch { showToast('Erro ao carregar clientes') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function onSaved() {
    setModal(null)
    showToast('Cliente salvo com sucesso!')
    load()
  }

  async function handleDelete(c) {
    if (!confirm(`Remover "${c.nome}"? Esta ação não pode ser desfeita.`)) return
    try {
      await api.deleteClient(c.id)
      showToast('Cliente removido.')
      load()
    } catch { showToast('Erro ao remover cliente.') }
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    const matchQ    = !q || c.nome?.toLowerCase().includes(q) || c.responsavel?.toLowerCase().includes(q) || c.cnpj?.toLowerCase().includes(q)
    const matchSt   = !fStatus || c.ativo === fStatus
    const matchNiv  = !fNivel  || c.nivel?.includes(fNivel)
    const matchResp = !fResp   || c.responsavel === fResp
    return matchQ && matchSt && matchNiv && matchResp
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const slice = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE)

  const sel = { background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:13, color:'var(--text)', fontFamily:'DM Sans, sans-serif', outline:'none', cursor:'pointer' }
  const th  = { padding:'12px 16px', textAlign:'left', fontSize:11, fontFamily:'DM Mono, monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:500, whiteSpace:'nowrap' }
  const td  = { padding:'13px 16px', fontSize:13, borderTop:'1px solid var(--border)', verticalAlign:'middle' }

  return (
    <div>
      <Topbar title="Gestão de Clientes" actions={
        <Btn variant="primary" onClick={() => setModal({})}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo Cliente
        </Btn>
      } />

      <div style={{ padding:'28px 32px' }}>
        {/* Filters */}
        <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ flex:1, minWidth:200, position:'relative' }}>
            <svg style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--muted)', width:15, height:15, pointerEvents:'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar por cliente, CNPJ, responsável..."
              style={{ ...sel, width:'100%', paddingLeft:36 }} />
          </div>
          <select style={sel} value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1) }}>
            <option value="">Todos os status</option>
            <option value="Sim">Ativo</option>
            <option value="Não">Inativo</option>
          </select>
          <select style={sel} value={fNivel} onChange={e => { setFNivel(e.target.value); setPage(1) }}>
            <option value="">Todos os níveis</option>
            <option value="1">Nível 1 — Acima de 50K</option>
            <option value="2">Nível 2 — 10K a 50K</option>
            <option value="3">Nível 3 — 5K a 10K</option>
            <option value="4">Nível 4 — Abaixo de 5K</option>
          </select>
          <select style={sel} value={fResp} onChange={e => { setFResp(e.target.value); setPage(1) }}>
            <option value="">Todos os responsáveis</option>
            <option value="Felipe Gomes">Felipe Gomes</option>
            <option value="Rafael Santiago">Rafael Santiago</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
          {loading ? (
            <div style={{ padding:60, textAlign:'center', color:'var(--muted)', fontSize:14 }}>Carregando...</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ background:'var(--surface2)' }}>
                <tr>
                  {['Cliente','Status','Nível','Consumo / mês','Responsável','Dash BI','Ações'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 ? (
                  <tr><td colSpan="7" style={{ padding:60, textAlign:'center', color:'var(--muted)' }}>Nenhum cliente encontrado</td></tr>
                ) : slice.map(c => (
                  <tr key={c.id} style={{ cursor:'pointer' }} onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                    <td style={td} onClick={() => setModal(c)}>
                      <div style={{ fontWeight:500 }}>{c.nome}</div>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{c.cnpj || '—'}</div>
                    </td>
                    <td style={td} onClick={() => setModal(c)}>
                      <Badge color={c.ativo==='Sim' ? 'green' : 'red'}>
                        <span style={{ width:6, height:6, borderRadius:'50%', background:'currentColor', display:'inline-block', marginRight:5 }}/>
                        {c.ativo==='Sim' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td style={td} onClick={() => setModal(c)}>{nivelBadge(c.nivel)}</td>
                    <td style={{ ...td, fontFamily:'DM Mono, monospace', color: c.consumo>50000 ? 'var(--accent)' : c.consumo>10000 ? 'var(--accent2)' : 'var(--text)' }} onClick={() => setModal(c)}>{fmt(c.consumo)}</td>
                    <td style={{ ...td, fontSize:12 }} onClick={() => setModal(c)}>{c.responsavel || '—'}</td>
                    <td style={td} onClick={() => setModal(c)}>{dashBadge(c.dashBI)}</td>
                    <td style={td}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => setModal(c)} style={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:6, padding:'5px 10px', fontSize:12, color:'var(--text)', cursor:'pointer' }}>Editar</button>
                        <button onClick={() => handleDelete(c)} style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, padding:'5px 10px', fontSize:12, color:'var(--accent4)', cursor:'pointer' }}>Remover</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderTop:'1px solid var(--border)' }}>
            <div style={{ fontSize:12, color:'var(--muted)' }}>
              {filtered.length > 0 ? `${(page-1)*PER_PAGE+1}–${Math.min(page*PER_PAGE, filtered.length)} de ${filtered.length} clientes` : '0 clientes'}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {Array.from({ length: totalPages }, (_, i) => i+1).map(p => (
                <button key={p} onClick={() => setPage(p)} style={{ background: p===page ? 'var(--accent)' : 'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 10px', fontSize:12, color: p===page ? '#000' : 'var(--text)', cursor:'pointer', fontWeight: p===page ? 600 : 400 }}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {modal !== null && <ClientModal client={modal?.id ? modal : null} onClose={() => setModal(null)} onSaved={onSaved} />}

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:'var(--surface)', border:'1px solid var(--accent)', borderRadius:'var(--radius-sm)', padding:'12px 18px', fontSize:13, zIndex:300, display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
          <div style={{ width:8, height:8, background:'var(--accent)', borderRadius:'50%' }} />
          {toast}
        </div>
      )}
    </div>
  )
}
