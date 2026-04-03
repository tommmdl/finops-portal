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
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div style={css.brand}>FinOps Portal</div>
            <div style={css.brandSub}>AWS MANAGEMENT</div>
            <div style={css.welcomeTitle}>{isLogin ? 'BEM-VINDO\nDE VOLTA!' : 'OLÁ!'}</div>
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
        onFocus={e => e.target.style.borderColor = '#00d4aa'}
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
    background: 'linear-gradient(135deg, #042c1e 0%, #0a3d2b 40%, #0f6e56 100%)',
    position: 'relative', overflow: 'hidden',
  },
  welcomeInner: {
    padding: '48px 40px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
  },
  logoMark: {
    width: 44, height: 44, background: '#00d4aa', borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  brand: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#e8eaf0' },
  brandSub: { fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#00d4aa', letterSpacing: '0.12em', marginTop: -8 },
  welcomeTitle: {
    fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 36, color: '#ffffff',
    lineHeight: 1.15, marginTop: 16, whiteSpace: 'pre-line',
  },
  welcomeText: { fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, maxWidth: 260 },
  ghostBtn: {
    marginTop: 8, padding: '10px 24px', background: 'transparent',
    border: '1.5px solid #00d4aa', borderRadius: 25, color: '#00d4aa',
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
    width: '100%', padding: '13px', background: '#00d4aa', border: 'none',
    borderRadius: 10, color: '#000', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: 4,
    transition: 'background 0.2s',
  },
  switchText: { textAlign: 'center', fontSize: 13, color: '#6b7280', marginTop: 20 },
  link: { color: '#00d4aa', cursor: 'pointer', fontWeight: 500 },
  error: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginBottom: 12,
  },
}
