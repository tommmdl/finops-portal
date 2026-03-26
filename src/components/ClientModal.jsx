import { useState, useEffect } from 'react'
import { api } from '../services/api.js'

const NIVEIS = ['Nível 1 - Acima de 50K','Nível 2 - Entre 10k e 50K','Nível 3 - Entre 5K e 10K','Nível 4 - Abaixo de 5K']
const RESPONSAVEIS = ['Felipe Gomes','Rafael Santiago','N/A']

function Field({ label, value }) {
  return (
    <div style={{ background:'var(--surface2)', borderRadius:'var(--radius-sm)', padding:'12px 14px' }}>
      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:500 }}>{value || '—'}</div>
    </div>
  )
}

function Input({ label, name, value, onChange, type = 'text' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <label style={{ fontSize:12, color:'var(--muted)' }}>{label}</label>
      <input
        name={name} value={value} onChange={onChange} type={type}
        style={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:13, color:'var(--text)', fontFamily:'DM Sans, sans-serif', outline:'none' }}
      />
    </div>
  )
}

function Select({ label, name, value, onChange, options }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <label style={{ fontSize:12, color:'var(--muted)' }}>{label}</label>
      <select name={name} value={value} onChange={onChange}
        style={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:13, color:'var(--text)', fontFamily:'DM Sans, sans-serif', outline:'none' }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export default function ClientModal({ client, onClose, onSaved }) {
  const isNew = !client?.id
  const [form, setForm] = useState({
    nome:'', razaoSocial:'', cnpj:'', ativo:'Sim', consumo:0,
    responsavel:'Felipe Gomes', nivel: NIVEIS[3], amCliente:'',
    acessoConta:'Individual', contaPayer:'', dashBI:'Sem Acesso',
    cms:'Não', pls:'Não', envioFatura:'Padrão', simplesNacional:'Não',
    ...client,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.nome.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true); setError('')
    try {
      if (isNew) await api.createClient(form)
      else       await api.updateClient(client.id, form)
      onSaved()
    } catch(e) {
      setError('Erro ao salvar. Tente novamente.')
    } finally { setSaving(false) }
  }

  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(6px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }
  const modal   = { background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:16, width:'100%', maxWidth:680, maxHeight:'90vh', overflowY:'auto' }
  const header  = { padding:'24px 24px 16px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', borderBottom:'1px solid var(--border)', position:'sticky', top:0, background:'var(--surface)', zIndex:1 }
  const body    = { padding:24 }
  const footer  = { padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }
  const grid2   = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }
  const secTitle = { fontSize:11, color:'var(--muted)', fontFamily:'DM Mono, monospace', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12, marginTop:20 }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={header}>
          <div>
            <div style={{ fontFamily:'Syne, sans-serif', fontSize:20, fontWeight:700 }}>{isNew ? 'Novo Cliente' : client.nome}</div>
            <div style={{ fontSize:13, color:'var(--muted)', marginTop:4 }}>{isNew ? 'Preencha os dados' : client.razaoSocial || '—'}</div>
          </div>
          <button onClick={onClose} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={body}>
          <div style={secTitle}>Identificação</div>
          <div style={grid2}>
            <Input label="Nome / Apelido *" name="nome" value={form.nome} onChange={handleChange} />
            <Input label="Razão Social" name="razaoSocial" value={form.razaoSocial} onChange={handleChange} />
            <Input label="CNPJ" name="cnpj" value={form.cnpj} onChange={handleChange} />
            <Input label="Conta Payer AWS" name="contaPayer" value={form.contaPayer} onChange={handleChange} />
          </div>

          <div style={secTitle}>Classificação & Consumo</div>
          <div style={grid2}>
            <Select label="Status" name="ativo" value={form.ativo} onChange={handleChange} options={['Sim','Não']} />
            <Input label="Consumo médio / mês (USD)" name="consumo" value={form.consumo} onChange={handleChange} type="number" />
            <Select label="Nível" name="nivel" value={form.nivel} onChange={handleChange} options={NIVEIS} />
            <Select label="Simples Nacional" name="simplesNacional" value={form.simplesNacional} onChange={handleChange} options={['Sim','Não']} />
            <Select label="Envio de Fatura" name="envioFatura" value={form.envioFatura} onChange={handleChange} options={['Padrão','Data Corte - dia 10']} />
          </div>

          <div style={secTitle}>Relacionamento</div>
          <div style={grid2}>
            <Select label="Responsável" name="responsavel" value={form.responsavel} onChange={handleChange} options={RESPONSAVEIS} />
            <Input label="AM do Cliente" name="amCliente" value={form.amCliente} onChange={handleChange} />
            <Select label="Acesso à Conta" name="acessoConta" value={form.acessoConta} onChange={handleChange} options={['Individual','Solvimm','Sem Acesso']} />
            <Select label="Dashboard BI" name="dashBI" value={form.dashBI} onChange={handleChange} options={['Sem Acesso','Liberar','Acessando']} />
          </div>

          <div style={secTitle}>Serviços</div>
          <div style={{ ...grid2, gridTemplateColumns:'1fr 1fr 1fr' }}>
            <Select label="CMS" name="cms" value={form.cms} onChange={handleChange} options={['Sim','Não']} />
            <Select label="PLS" name="pls" value={form.pls} onChange={handleChange} options={['Sim','Não']} />
          </div>
        </div>

        <div style={footer}>
          <div style={{ fontSize:13, color:'var(--accent4)' }}>{error}</div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)', padding:'8px 16px', fontSize:13, color:'var(--text)', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', padding:'8px 18px', fontSize:13, fontWeight:600, color:'#000', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily:'DM Sans, sans-serif' }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
