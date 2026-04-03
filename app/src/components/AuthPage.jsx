import { useState } from 'react'
import { signIn, signUp, confirmSignUp, resendSignUpCode } from 'aws-amplify/auth'

export default function AuthPage({ onSignIn }) {
  const [mode, setMode]       = useState('login')   // 'login' | 'register' | 'confirm'
  const [sliding, setSliding] = useState(false)
  const [form, setForm]       = useState({ email: '', password: '', code: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')

  function slide(to) {
    if (sliding) return
    setSliding(true)
    setError('')
    setTimeout(() => { setMode(to); setSliding(false) }, 400)
  }

  function handle(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await signIn({ username: form.email, password: form.password })
      onSignIn()
    } catch (err) {
      setError(err.message || 'Erro ao fazer login')
    } finally { setLoading(false) }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await signUp({ username: form.email, password: form.password, options: { userAttributes: { email: form.email } } })
      setPendingEmail(form.email)
      setMode('confirm')
    } catch (err) {
      setError(err.message || 'Erro ao criar conta')
    } finally { setLoading(false) }
  }

  async function handleConfirm(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await confirmSignUp({ username: pendingEmail, confirmationCode: form.code })
      await signIn({ username: pendingEmail, password: form.password })
      onSignIn()
    } catch (err) {
      setError(err.message || 'Código inválido')
    } finally { setLoading(false) }
  }

  const isLogin    = mode === 'login'
  const isRegister = mode === 'register'
  const isConfirm  = mode === 'confirm'

  return (
    <div style={css.page}>
      <div style={{ ...css.container, transform: sliding ? 'scale(0.97)' : 'scale(1)', opacity: sliding ? 0 : 1, transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)' }}>

        {/* Painel esquerdo — boas vindas */}
        <div style={{ ...css.panel, ...css.welcome, transform: isLogin ? 'translateX(0)' : 'translateX(100%)' }}>
          <div style={css.welcomeInner}>
            <div style={css.logoMark}>
              <svg width="26" height="36" viewBox="0 0 35 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.71928 4.67807L14.0795 0.317849C14.284 0.114281 14.5609 0 14.8495 0C15.1381 0 15.4149 0.114281 15.6194 0.317849L19.9856 4.67807C20.1891 4.88262 20.3034 5.15946 20.3034 5.44804C20.3034 5.73662 20.1891 6.01346 19.9856 6.21801L15.6194 10.5782C15.4149 10.7818 15.1381 10.8961 14.8495 10.8961C14.5609 10.8961 14.284 10.7818 14.0795 10.5782L9.71928 6.21801C9.51571 6.01346 9.40143 5.73662 9.40143 5.44804C9.40143 5.15946 9.51571 4.88262 9.71928 4.67807Z" fill="white"/>
                <path d="M0.320291 44.0971L14.0795 30.332C14.284 30.1284 14.5609 30.0142 14.8494 30.0142C15.138 30.0142 15.4149 30.1284 15.6194 30.332L29.3845 44.0971C29.5881 44.3016 29.7023 44.5785 29.7023 44.8671C29.7023 45.1556 29.5881 45.4325 29.3845 45.637L25.3488 49.6727C25.1442 49.8763 24.8674 49.9906 24.5788 49.9906C24.2902 49.9906 24.0134 49.8763 23.8088 49.6727L15.6194 41.4833C15.5189 41.3811 15.3991 41.2999 15.2669 41.2445C15.1347 41.1891 14.9928 41.1605 14.8494 41.1605C14.7061 41.1605 14.5642 41.1891 14.432 41.2445C14.2998 41.2999 14.18 41.3811 14.0795 41.4833L5.89004 49.6727C5.68549 49.8763 5.40866 49.9906 5.12007 49.9906C4.83149 49.9906 4.55465 49.8763 4.3501 49.6727L0.320291 45.637C0.116723 45.4325 0.00244141 45.1556 0.00244141 44.8671C0.00244141 44.5785 0.116723 44.3016 0.320291 44.0971Z" fill="white"/>
                <path d="M14.0795 25.0983L5.89005 33.2877C5.6855 33.4913 5.40866 33.6056 5.12008 33.6056C4.83149 33.6056 4.55466 33.4913 4.35011 33.2877L0.320295 29.252C0.21879 29.1511 0.138236 29.0312 0.083267 28.899C0.0282982 28.7669 0 28.6252 0 28.482C0 28.3389 0.0282982 28.1972 0.083267 28.0651C0.138236 27.9329 0.21879 27.813 0.320295 27.7121L14.0795 13.947C14.284 13.7434 14.5609 13.6292 14.8494 13.6292C15.138 13.6292 15.4149 13.7434 15.6194 13.947L23.9799 22.3075C24.1845 22.5111 24.4613 22.6254 24.7499 22.6254C25.0385 22.6254 25.3153 22.5111 25.5199 22.3075L29.1131 18.7143C29.3176 18.5108 29.5945 18.3965 29.8831 18.3965C30.1716 18.3965 30.4485 18.5108 30.653 18.7143L34.5235 22.5848C34.7271 22.7894 34.8414 23.0662 34.8414 23.3548C34.8414 23.6434 34.7271 23.9202 34.5235 24.1248L25.3488 33.2877C25.1442 33.4913 24.8674 33.6056 24.5788 33.6056C24.2902 33.6056 24.0134 33.4913 23.8088 33.2877L15.6194 25.0983C15.4149 24.8947 15.138 24.7805 14.8494 24.7805C14.5609 24.7805 14.284 24.8947 14.0795 25.0983Z" fill="white"/>
              </svg>
            </div>
            <div style={css.brand}>FinOps Portal</div>
            <div style={css.brandSub}>AWS MANAGEMENT</div>
            <div style={css.welcomeTitle}>{isLogin ? 'BEM-VINDO\nE-COREAN!' : 'OLÁ!'}</div>
            <div style={css.welcomeText}>
              {isLogin
                ? 'Acesse sua conta para gerenciar os clientes FinOps da e-Core.'
                : 'Já tem uma conta? Faça login para continuar.'}
            </div>
            <button style={css.ghostBtn} onClick={() => slide(isLogin ? 'register' : 'login')}>
              {isLogin ? 'Criar conta' : 'Fazer login'}
            </button>
          </div>
        </div>

        {/* Painel direito — formulário */}
        <div style={{ ...css.panel, ...css.form, transform: isLogin ? 'translateX(0)' : 'translateX(-100%)' }}>
          <div style={css.formInner}>

            {/* LOGIN */}
            {isLogin && (
              <>
                <h2 style={css.title}>Login</h2>
                <form onSubmit={handleLogin} style={css.formEl}>
                  <Field icon="email" name="email" type="email" placeholder="E-mail" value={form.email} onChange={handle} />
                  <Field icon="lock"  name="password" type="password" placeholder="Senha" value={form.password} onChange={handle} />
                  {error && <div style={css.error}>{error}</div>}
                  <button type="submit" style={css.btn} disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                  </button>
                  <div style={css.switchText}>
                    Não tem conta?{' '}
                    <span style={css.link} onClick={() => slide('register')}>Criar agora</span>
                  </div>
                </form>
              </>
            )}

            {/* REGISTER */}
            {isRegister && (
              <>
                <h2 style={css.title}>Criar conta</h2>
                <form onSubmit={handleRegister} style={css.formEl}>
                  <Field icon="email" name="email" type="email" placeholder="E-mail corporativo" value={form.email} onChange={handle} />
                  <Field icon="lock"  name="password" type="password" placeholder="Senha (mín. 8 caracteres)" value={form.password} onChange={handle} />
                  {error && <div style={css.error}>{error}</div>}
                  <button type="submit" style={css.btn} disabled={loading}>
                    {loading ? 'Criando...' : 'Criar conta'}
                  </button>
                  <div style={css.switchText}>
                    Já tem conta?{' '}
                    <span style={css.link} onClick={() => slide('login')}>Fazer login</span>
                  </div>
                </form>
              </>
            )}

            {/* CONFIRM */}
            {isConfirm && (
              <>
                <h2 style={css.title}>Verificar e-mail</h2>
                <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
                  Enviamos um código para <strong style={{ color: '#e8eaf0' }}>{pendingEmail}</strong>. Verifique sua caixa de entrada.
                </p>
                <form onSubmit={handleConfirm} style={css.formEl}>
                  <Field icon="code" name="code" type="text" placeholder="Código de verificação" value={form.code} onChange={handle} />
                  {error && <div style={css.error}>{error}</div>}
                  <button type="submit" style={css.btn} disabled={loading}>
                    {loading ? 'Verificando...' : 'Confirmar'}
                  </button>
                  <div style={css.switchText}>
                    <span style={css.link} onClick={() => resendSignUpCode({ username: pendingEmail })}>
                      Reenviar código
                    </span>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}

function Field({ icon, name, type, placeholder, value, onChange }) {
  const icons = {
    email: <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>,
    lock:  <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    code:  <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
  }
  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <svg style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#6b7280', width:16, height:16, pointerEvents:'none' }}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {icons[icon]}
      </svg>
      <input name={name} type={type} placeholder={placeholder} value={value} onChange={onChange} required
        style={{ width:'100%', background:'#191d24', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'12px 14px 12px 42px', fontSize:14, color:'#e8eaf0', fontFamily:'DM Sans, sans-serif', outline:'none', boxSizing:'border-box', transition:'border-color 0.2s' }}
        onFocus={e => e.target.style.borderColor = '#00BEC8'}
        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
      />
    </div>
  )
}

const css = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0a0c10', padding: 20,
  },
  container: {
    display: 'flex', width: '100%', maxWidth: 860, minHeight: 520,
    borderRadius: 20, overflow: 'hidden',
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  panel: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
  },
  welcome: {
    background: 'linear-gradient(135deg, #001a35 0%, #00325A 40%, #113157 100%)',
    position: 'relative', overflow: 'hidden',
  },
  welcomeInner: {
    padding: '48px 40px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
  },
  logoMark: {
    width: 52, height: 52, background: 'linear-gradient(135deg, #00325A, #00BEC8)', borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    boxShadow: '0 4px 20px rgba(0,190,200,0.35)',
  },
  brand: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#e8eaf0' },
  brandSub: { fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#00BEC8', letterSpacing: '0.12em', marginTop: -8 },
  welcomeTitle: {
    fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 36, color: '#ffffff',
    lineHeight: 1.15, marginTop: 16, whiteSpace: 'pre-line',
  },
  welcomeText: { fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, maxWidth: 260 },
  ghostBtn: {
    marginTop: 8, padding: '10px 24px', background: 'transparent',
    border: '1.5px solid #00BEC8', borderRadius: 25, color: '#00BEC8',
    fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    transition: 'all 0.2s',
  },
  form: { background: '#111318' },
  formInner: { padding: '48px 40px', width: '100%', maxWidth: 360 },
  title: {
    fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 28,
    color: '#e8eaf0', marginBottom: 28,
  },
  formEl: { display: 'flex', flexDirection: 'column' },
  btn: {
    width: '100%', padding: '13px', background: '#00BEC8', border: 'none',
    borderRadius: 10, color: '#000', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: 4,
    transition: 'background 0.2s',
  },
  switchText: { textAlign: 'center', fontSize: 13, color: '#6b7280', marginTop: 20 },
  link: { color: '#00BEC8', cursor: 'pointer', fontWeight: 500 },
  error: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginBottom: 12,
  },
}
