import { useState, useEffect } from 'react'
import { api } from '../services/api.js'
import Topbar, { Btn } from '../components/Topbar.jsx'

function DownloadBtn({ href, label, icon }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      <button style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 18px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--accent)', background: 'rgba(0,212,170,0.1)',
        color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
        fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
      }}>
        {icon}
        {label}
      </button>
    </a>
  )
}

export default function Reports() {
  const [clients,  setClients]  = useState([])
  const [clientId, setClientId] = useState('')
  const [month,    setMonth]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState('')

  useEffect(() => {
    api.listClients({ ativo: 'Sim' })
      .then(r => setClients(r.items || []))
      .catch(() => {})
  }, [])

  const canGenerate = clientId && month && !loading

  async function handleGenerate() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await api.generateReport({ client_id: clientId, month })
      setResult(data)
    } catch (e) {
      setError(e.message || 'Erro ao gerar report. Verifique se o sync-costs já foi executado para este cliente.')
    } finally {
      setLoading(false)
    }
  }

  const inp   = { background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', outline: 'none', width: '100%' }
  const label = { fontSize: 12, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, display: 'block' }
  const card  = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 28 }

  return (
    <div>
      <Topbar title="Relatórios Mensais" />
      <div style={{ padding: '28px 32px', maxWidth: 760 }}>

        <div style={card}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 600, marginBottom: 24 }}>
            Gerar Report Mensal
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div>
              <label style={label}>Cliente</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} style={inp}>
                <option value="">Selecione o cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Mês de referência</label>
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                style={inp}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Btn variant="primary" onClick={handleGenerate} disabled={!canGenerate}>
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Gerando PPTX...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  Gerar Report
                </>
              )}
            </Btn>
            {loading && (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Buscando dados e gerando apresentação... pode levar ~30s
              </span>
            )}
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--accent4)' }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ ...card, marginTop: 20, borderColor: 'var(--accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, background: 'rgba(0,212,170,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14 }}>
                  Report gerado com sucesso!
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: 2 }}>
                  {result.client_name} · {result.month} · {result.services} serviços
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <DownloadBtn
                href={result.pptx_url}
                label="Baixar PowerPoint"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                }
              />
            </div>

            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
              Link expira em 5 minutos
            </div>
          </div>
        )}

      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
