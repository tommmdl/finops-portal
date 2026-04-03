export default function Topbar({ title, actions }) {
  return (
    <div style={{
      position:'sticky', top:0,
      background:'rgba(10,12,16,0.92)', backdropFilter:'blur(12px)',
      borderBottom:'1px solid var(--border)', padding:'16px 32px',
      display:'flex', alignItems:'center', justifyContent:'space-between', zIndex:50,
    }}>
      <div style={{ fontFamily:'Syne, sans-serif', fontSize:20, fontWeight:700 }}>{title}</div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>{actions}</div>
    </div>
  )
}

export function Btn({ variant = 'ghost', onClick, children, disabled }) {
  const base = { display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:'var(--radius-sm)', fontSize:13, fontWeight:500, cursor: disabled ? 'not-allowed' : 'pointer', border:'none', transition:'all 0.15s', fontFamily:'DM Sans, sans-serif', opacity: disabled ? 0.5 : 1 }
  const styles = {
    primary: { ...base, background:'var(--accent)', color:'#000' },
    ghost:   { ...base, background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border2)' },
    danger:  { ...base, background:'rgba(239,68,68,0.15)', color:'var(--accent4)', border:'1px solid rgba(239,68,68,0.3)' },
  }
  return <button style={styles[variant]} onClick={onClick} disabled={disabled}>{children}</button>
}
