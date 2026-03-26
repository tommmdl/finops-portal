const S = {
  sidebar: { position:'fixed', top:0, left:0, width:220, height:'100vh', background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', zIndex:100, padding:'24px 0' },
  logo: { padding:'0 20px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 },
  logoIcon: { width:32, height:32, background:'var(--accent)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  nav: { flex:1, padding:'16px 12px', display:'flex', flexDirection:'column', gap:4 },
  sep: { height:1, background:'var(--border)', margin:'8px 0' },
  footer: { padding:'16px 20px', borderTop:'1px solid var(--border)' },
  userChip: { display:'flex', alignItems:'center', gap:10 },
  avatar: { width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg, #00d4aa, #0ea5e9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#000', flexShrink:0 },
}

function NavItem({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
      borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:14,
      fontWeight: active ? 500 : 400,
      color: active ? 'var(--accent)' : 'var(--muted)',
      background: active ? 'rgba(0,212,170,0.1)' : 'none',
      border:'none', textAlign:'left', width:'100%', fontFamily:'DM Sans, sans-serif',
      transition:'all 0.15s',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {icon}
      </svg>
      {label}
    </button>
  )
}

export default function Sidebar({ page, setPage, user, signOut }) {
  // Compatível com Amplify v5 e v6
  const email = user?.attributes?.email
    || user?.signInDetails?.loginId
    || user?.username
    || 'admin'
  const initials = email.substring(0, 2).toUpperCase()

  return (
    <nav style={S.sidebar}>
      <div style={S.logo}>
        <div style={S.logoIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div>
          <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:15 }}>FinOps Portal</div>
          <div style={{ fontSize:10, color:'var(--muted)', fontFamily:'DM Mono, monospace', letterSpacing:'0.08em' }}>AWS MANAGEMENT</div>
        </div>
      </div>

      <div style={S.nav}>
        <NavItem active={page==='dashboard'} onClick={() => setPage('dashboard')} label="Dashboard"
          icon={<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>} />
        <NavItem active={page==='clients'} onClick={() => setPage('clients')} label="Clientes"
          icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>} />
        <div style={S.sep} />
        <NavItem active={false} onClick={() => {}} label="Relatórios"
          icon={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>} />
        <NavItem active={false} onClick={() => {}} label="Consumo AWS"
          icon={<><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>} />
      </div>

      <div style={S.footer}>
        <div style={S.userChip}>
          <div style={S.avatar}>{initials}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{email}</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>FinOps Manager</div>
          </div>
          <button onClick={signOut} title="Sair" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}
