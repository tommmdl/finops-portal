const S = {
  sidebar: { position:'fixed', top:0, left:0, width:220, height:'100vh', background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', zIndex:100, padding:'24px 0' },
  logo: { padding:'0 20px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 },
  logoIcon: { width:36, height:36, background:'linear-gradient(135deg, #00325A, #00BEC8)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 2px 12px rgba(0,190,200,0.3)' },
  nav: { flex:1, padding:'16px 12px', display:'flex', flexDirection:'column', gap:4 },
  sep: { height:1, background:'var(--border)', margin:'8px 0' },
  footer: { padding:'16px 20px', borderTop:'1px solid var(--border)' },
  userChip: { display:'flex', alignItems:'center', gap:10 },
  avatar: { width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg, #00BEC8, #0096DC)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#000', flexShrink:0 },
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
          <svg width="20" height="28" viewBox="0 0 35 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.71928 4.67807L14.0795 0.317849C14.284 0.114281 14.5609 0 14.8495 0C15.1381 0 15.4149 0.114281 15.6194 0.317849L19.9856 4.67807C20.1891 4.88262 20.3034 5.15946 20.3034 5.44804C20.3034 5.73662 20.1891 6.01346 19.9856 6.21801L15.6194 10.5782C15.4149 10.7818 15.1381 10.8961 14.8495 10.8961C14.5609 10.8961 14.284 10.7818 14.0795 10.5782L9.71928 6.21801C9.51571 6.01346 9.40143 5.73662 9.40143 5.44804C9.40143 5.15946 9.51571 4.88262 9.71928 4.67807Z" fill="white"/>
            <path d="M0.320291 44.0971L14.0795 30.332C14.284 30.1284 14.5609 30.0142 14.8494 30.0142C15.138 30.0142 15.4149 30.1284 15.6194 30.332L29.3845 44.0971C29.5881 44.3016 29.7023 44.5785 29.7023 44.8671C29.7023 45.1556 29.5881 45.4325 29.3845 45.637L25.3488 49.6727C25.1442 49.8763 24.8674 49.9906 24.5788 49.9906C24.2902 49.9906 24.0134 49.8763 23.8088 49.6727L15.6194 41.4833C15.5189 41.3811 15.3991 41.2999 15.2669 41.2445C15.1347 41.1891 14.9928 41.1605 14.8494 41.1605C14.7061 41.1605 14.5642 41.1891 14.432 41.2445C14.2998 41.2999 14.18 41.3811 14.0795 41.4833L5.89004 49.6727C5.68549 49.8763 5.40866 49.9906 5.12007 49.9906C4.83149 49.9906 4.55465 49.8763 4.3501 49.6727L0.320291 45.637C0.116723 45.4325 0.00244141 45.1556 0.00244141 44.8671C0.00244141 44.5785 0.116723 44.3016 0.320291 44.0971Z" fill="white"/>
            <path d="M14.0795 25.0983L5.89005 33.2877C5.6855 33.4913 5.40866 33.6056 5.12008 33.6056C4.83149 33.6056 4.55466 33.4913 4.35011 33.2877L0.320295 29.252C0.21879 29.1511 0.138236 29.0312 0.083267 28.899C0.0282982 28.7669 0 28.6252 0 28.482C0 28.3389 0.0282982 28.1972 0.083267 28.0651C0.138236 27.9329 0.21879 27.813 0.320295 27.7121L14.0795 13.947C14.284 13.7434 14.5609 13.6292 14.8494 13.6292C15.138 13.6292 15.4149 13.7434 15.6194 13.947L23.9799 22.3075C24.1845 22.5111 24.4613 22.6254 24.7499 22.6254C25.0385 22.6254 25.3153 22.5111 25.5199 22.3075L29.1131 18.7143C29.3176 18.5108 29.5945 18.3965 29.8831 18.3965C30.1716 18.3965 30.4485 18.5108 30.653 18.7143L34.5235 22.5848C34.7271 22.7894 34.8414 23.0662 34.8414 23.3548C34.8414 23.6434 34.7271 23.9202 34.5235 24.1248L25.3488 33.2877C25.1442 33.4913 24.8674 33.6056 24.5788 33.6056C24.2902 33.6056 24.0134 33.4913 23.8088 33.2877L15.6194 25.0983C15.4149 24.8947 15.138 24.7805 14.8494 24.7805C14.5609 24.7805 14.284 24.8947 14.0795 25.0983Z" fill="white"/>
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
        <NavItem active={page==='reports'} onClick={() => setPage('reports')} label="Relatórios"
          icon={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>} />
        <NavItem active={page==='semanal'} onClick={() => setPage('semanal')} label="Semanal"
          icon={<>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            <circle cx="18" cy="5" r="3" fill="var(--accent4)" stroke="none"/>
          </>} />
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
