import { useState } from 'react'
import { api } from '../services/api.js'
import Topbar, { Btn } from '../components/Topbar.jsx'

const CLIENTS = [
  { slug: 'wilson-sons',   name: 'Wilson Sons' },
  { slug: 'delta-energia', name: 'Delta Energia' },
  { slug: 'easy-carros',   name: 'Easy Carros' },
  { slug: 'compliance',    name: 'Compliance' },
  { slug: 'rediseg',       name: 'Rediseg' },
  { slug: 'ubots',         name: 'Ubots' },
]

function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload  = () => res(reader.result.split(',')[1])
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

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
  const [clientSlug, setClientSlug] = useState('')
  const [month,      setMonth]      = useState('')
  const [csvFile,    setCsvFile]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState(null)
  const [error,      setError]      = useState('')

  const canGenerate = clientSlug && month && csvFile && !loading

  async function handleGenerate() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const csvContent = await toBase64(csvFile)
      const data = await api.generateReport({ client_slug: clientSlug, month, csv_content: csvContent })
      setResult(data)
    } catch (e) {
      setError(e.message || 'Erro ao gerar report. Verifique o CSV e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const inp = {
    background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13,
    color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', outline: 'none',
    width: '100%',
  }
  const label = { fontSize: 12, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, display: 'block' }
  const card  = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 28 }

  return (
    <div>
      <Topbar title="Relatórios Mensais" />
      <div style={{ padding: '28px 32px', maxWidth: 760 }}>

        {/* Formulário */}
        <div style={card}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 600, marginBottom: 24 }}>
            Gerar Report Mensal
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div>
              <label style={label}>Cliente</label>
              <select value={clientSlug} onChange={e => setClientSlug(e.target.value)} style={inp}>
                <option value="">Selecione o cliente</option>
                {CLIENTS.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
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

          <div style={{ marginBottom: 24 }}>
            <label style={label}>CSV do Cost Explorer</label>
            <div
              onClick={() => document.getElementById('csv-input').click()}
              style={{
                border: `2px dashed ${csvFile ? 'var(--accent)' : 'var(--border2)'}`,
                borderRadius: 'var(--radius-sm)', padding: '20px 16px',
                textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                background: csvFile ? 'rgba(0,212,170,0.05)' : 'transparent',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={csvFile ? 'var(--accent)' : 'var(--muted)'} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div style={{ fontSize: 13, color: csvFile ? 'var(--accent)' : 'var(--muted)' }}>
                {csvFile ? csvFile.name : 'Clique para selecionar o CSV exportado do Cost Explorer'}
              </div>
              {csvFile && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, fontFamily: 'DM Mono, monospace' }}>
                  {(csvFile.size / 1024).toFixed(1)} KB
                </div>
              )}
            </div>
            <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => setCsvFile(e.target.files[0] || null)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Btn variant="primary" onClick={handleGenerate} disabled={!canGenerate}>
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Gerando...
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
                Processando dados e gerando arquivos... pode levar ~30s
              </span>
            )}
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--accent4)' }}>
            {error}
          </div>
        )}

        {/* Resultado */}
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
                href={result.excel_url}
                label="Baixar Excel"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                }
              />
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
              Links expiram em 24 horas
            </div>
          </div>
        )}

      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
