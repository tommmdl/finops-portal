import { useState, useEffect } from 'react'
import { api } from '../services/api.js'
import Topbar, { Btn } from '../components/Topbar.jsx'

const fmt = v => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v || 0)

function KpiCard({ label, value, sub, color }) {
  const colors = { green:'var(--accent)', blue:'var(--accent2)', amber:'var(--accent3)', red:'var(--accent4)' }
  const c = colors[color]
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:20, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:c }} />
      <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily:'DM Mono, monospace' }}>{label}</div>
      <div style={{ fontFamily:'Syne, sans-serif', fontSize:28, fontWeight:700, color:c }}>{value}</div>
      <div style={{ fontSize:12, color:'var(--muted)', marginTop:6 }}>{sub}</div>
    </div>
  )
}

function Bar({ label, count, total, color }) {
  const pct = total ? Math.round(count / total * 100) : 0
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
        <span>{label}</span>
        <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:'var(--muted)' }}>{count}</span>
      </div>
      <div style={{ height:6, background:'var(--surface3)', borderRadius:3 }}>
        <div style={{ height:6, borderRadius:3, width:`${pct}%`, background:color, transition:'width 0.8s ease' }} />
      </div>
    </div>
  )
}

export default function Dashboard({ setPage }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listClients().then(r => { setClients(r.items || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const ativos   = clients.filter(c => c.ativo === 'Sim')
  const inativos = clients.filter(c => c.ativo !== 'Sim')
  const consumo  = ativos.reduce((s, c) => s + Number(c.consumo || 0), 0)
  const n1       = ativos.filter(c => c.nivel?.includes('1')).length
  const top8     = [...ativos].sort((a,b) => b.consumo - a.consumo).slice(0, 8)

  const byResp = ['Felipe Gomes','Rafael Santiago'].map(r => ({
    name: r,
    clients: ativos.filter(c => c.responsavel === r),
    total: ativos.filter(c => c.responsavel === r).reduce((s,c) => s + Number(c.consumo||0), 0),
  }))

  const card  = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:20 }
  const title = { fontFamily:'Syne, sans-serif', fontSize:14, fontWeight:600, marginBottom:20 }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh', color:'var(--muted)', fontSize:14 }}>
      Carregando dados...
    </div>
  )

  return (
    <div>
      <Topbar title="Dashboard" actions={
        <Btn variant="primary" onClick={() => setPage('clients')}>Ver todos os clientes</Btn>
      } />
      <div style={{ padding:'28px 32px' }}>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
          <KpiCard label="Total de Clientes" value={clients.length} sub={`${ativos.length} ativos`} color="green" />
          <KpiCard label="Consumo Total / mês" value={fmt(consumo)} sub="apenas clientes ativos" color="blue" />
          <KpiCard label="Clientes Nível 1" value={n1} sub="acima de $50K/mês" color="amber" />
          <KpiCard label="Clientes Inativos" value={inativos.length} sub={`${clients.length ? Math.round(inativos.length/clients.length*100) : 0}% do total`} color="red" />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          <div style={card}>
            <div style={title}>Distribuição por Nível</div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[['1','Nível 1 — Acima de 50K','var(--accent)'],['2','Nível 2 — 10K a 50K','var(--accent2)'],['3','Nível 3 — 5K a 10K','var(--accent3)'],['4','Nível 4 — Abaixo de 5K','var(--muted)']].map(([k,l,c]) =>
                <Bar key={k} label={l} count={ativos.filter(x=>x.nivel?.includes(k)).length} total={ativos.length} color={c} />
              )}
            </div>
          </div>

          <div style={card}>
            <div style={title}>Top 8 por Consumo</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {top8.map((c,i) => (
                <div key={c.id||i} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 10px', background:'var(--surface2)', borderRadius:'var(--radius-sm)' }}>
                  <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:'var(--muted)', width:18 }}>{i+1}</span>
                  <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{c.nome}</span>
                  <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:'var(--accent)' }}>{fmt(c.consumo)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={card}>
            <div style={title}>Consumo por Responsável</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {byResp.map(r => (
                <div key={r.name} style={{ background:'var(--surface2)', borderRadius:'var(--radius-sm)', padding:14 }}>
                  <div style={{ fontSize:13, fontWeight:500, marginBottom:4 }}>{r.name}</div>
                  <div style={{ fontFamily:'DM Mono, monospace', fontSize:18, color:'var(--accent)' }}>{fmt(r.total)}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{r.clients.length} clientes</div>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={title}>Status de Serviços (ativos)</div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[
                ['CMS ativo', ativos.filter(c=>c.cms==='Sim').length, 'var(--accent)'],
                ['PLS ativo', ativos.filter(c=>c.pls==='Sim').length, 'var(--accent2)'],
                ['Dash BI acessando', ativos.filter(c=>c.dashBI==='Acessando').length, 'var(--accent3)'],
                ['Dash BI a liberar', ativos.filter(c=>c.dashBI==='Liberar').length, 'var(--accent4)'],
              ].map(([l,count,color]) => <Bar key={l} label={l} count={count} total={ativos.length} color={color} />)}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
