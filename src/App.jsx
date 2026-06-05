import { useState, useEffect, useRef, createContext, useContext } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  supabase, signInWithEmail, signUpWithEmail, signInWithGoogle,
  signOut, getProfile, getSegnalazioni, insertSegnalazione,
  updateSegnalazione, uploadFoto
} from './lib/supabase.js'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const PERICOLOSITA_CONFIG = {
  bassa:   { color: '#22c55e', bg: '#dcfce7', text: '#15803d', label: 'Bassa' },
  media:   { color: '#eab308', bg: '#fef9c3', text: '#854d0e', label: 'Media' },
  alta:    { color: '#f97316', bg: '#ffedd5', text: '#9a3412', label: 'Alta' },
  critica: { color: '#ef4444', bg: '#fee2e2', text: '#991b1b', label: 'Critica' },
}
const STATO_CONFIG = {
  segnalata:      { bg: '#dbeafe', text: '#1e40af', label: 'Segnalata' },
  in_lavorazione: { bg: '#fef3c7', text: '#92400e', label: 'In lavorazione' },
  risolta:        { bg: '#d1fae5', text: '#065f46', label: 'Risolta' },
  rifiutata:      { bg: '#f3f4f6', text: '#374151', label: 'Rifiutata' },
}

const AuthContext = createContext(null)
const useAuth = () => useContext(AuthContext)

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%;max-width:100vw;overflow-x:hidden}
body{font-family:'DM Sans','Segoe UI',sans-serif;background:#0f172a;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#1e293b}::-webkit-scrollbar-thumb{background:#334155;border-radius:2px}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:none}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 4px rgba(59,130,246,0.35)}50%{box-shadow:0 0 0 9px rgba(59,130,246,0.08)}}
.fade-in{animation:fadeIn .22s ease}
.slide-up{animation:slideUp .28s cubic-bezier(.4,0,.2,1)}
.spin{animation:spin 1s linear infinite;display:inline-block}

/* Bottoni touch-friendly (min 44px tap target) */
.btn-p{background:#3b82f6;color:#fff;border:none;padding:14px 20px;border-radius:12px;cursor:pointer;font-weight:600;font-size:15px;font-family:inherit;transition:all .15s;width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;-webkit-tap-highlight-color:transparent}
.btn-p:active{background:#1d4ed8;transform:scale(0.98)}
.btn-p:disabled{background:#334155;color:#64748b;cursor:default;transform:none}
.btn-g{background:#1e293b;color:#94a3b8;border:1px solid #334155;padding:13px 18px;border-radius:12px;cursor:pointer;font-weight:500;font-size:15px;font-family:inherit;transition:all .15s;width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;-webkit-tap-highlight-color:transparent}
.btn-g:active{background:#0f172a;color:#e2e8f0}
.btn-sm{background:#1e293b;color:#94a3b8;border:1px solid #334155;padding:9px 14px;border-radius:9px;cursor:pointer;font-weight:500;font-size:13px;font-family:inherit;transition:all .15s;min-height:38px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;-webkit-tap-highlight-color:transparent}
.btn-sm:active{background:#0f172a;color:#e2e8f0}

input[type=text],input[type=email],input[type=password],textarea,select{
  background:#0f172a;border:1.5px solid #334155;color:#e2e8f0;
  padding:13px 14px;border-radius:10px;width:100%;font-size:15px;
  outline:none;transition:border .15s;font-family:inherit;
  -webkit-appearance:none;min-height:48px
}
input:focus,textarea:focus,select:focus{border-color:#3b82f6}
textarea{resize:vertical;min-height:90px}
select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
select option{background:#1e293b}

/* Bottom tab bar */
.tab-bar{position:fixed;bottom:0;left:0;right:0;background:#0f172a;border-top:1px solid #1e293b;display:flex;z-index:1000;padding-bottom:env(safe-area-inset-bottom)}
.tab-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 4px 8px;border:none;background:transparent;cursor:pointer;font-family:inherit;gap:3px;-webkit-tap-highlight-color:transparent;min-height:56px}
.tab-btn span.tab-icon{font-size:20px;line-height:1}
.tab-btn span.tab-label{font-size:10px;font-weight:600;letter-spacing:.3px}
`

function Badge({ cfg, children }) {
  return <span style={{ background: cfg.bg, color: cfg.text, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>
}

function Spinner() {
  return <span className="spin" style={{ fontSize: 16 }}>⟳</span>
}

function Toast({ toast }) {
  if (!toast) return null
  const map = { success: ['#065f46', '#10b981'], error: ['#7f1d1d', '#ef4444'], info: ['#1e3a5f', '#3b82f6'] }
  const [bg, border] = map[toast.type] || map.info
  return (
    <div style={{ position: 'fixed', top: 16, left: 16, right: 16, zIndex: 9999, background: bg, border: `1px solid ${border}`, color: 'white', padding: '14px 18px', borderRadius: 12, fontSize: 14, fontWeight: 500, animation: 'fadeIn .2s ease', lineHeight: 1.5, boxShadow: '0 4px 24px rgba(0,0,0,.4)' }}>
      {toast.msg}
    </div>
  )
}

function Card({ children, style }) {
  return <div style={{ background: '#1e293b', borderRadius: 16, padding: 20, border: '1px solid #334155', ...style }}>{children}</div>
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [page, setPage] = useState('mappa')
  const [segnalazioni, setSegnalazioni] = useState([])
  const [loadingSeg, setLoadingSeg] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfile(null); return }
    getProfile(session.user.id).then(setProfile).catch(console.error)
  }, [session])

  const loadSegnalazioni = async () => {
    setLoadingSeg(true)
    try { setSegnalazioni((await getSegnalazioni()) || []) }
    catch { showToast('Errore nel caricamento', 'error') }
    finally { setLoadingSeg(false) }
  }

  useEffect(() => { if (session) loadSegnalazioni() }, [session])

  useEffect(() => {
    if (!session) return
    const ch = supabase.channel('seg-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'segnalazioni' }, loadSegnalazioni)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [session])

  const handleLogout = async () => { await signOut(); setPage('mappa'); setSegnalazioni([]) }
  const isAdmin = profile?.role === 'admin' || profile?.role === 'supervisor'

  if (session === undefined) return (
    <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <style>{STYLES}</style>
      <img src="/logo.png" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover" }} alt="logo" />
      <div style={{ color: '#64748b', fontSize: 15 }}>Caricamento...</div>
    </div>
  )

  if (!session) return (
    <>
      <style>{STYLES}</style>
      <AuthPage showToast={showToast} />
      <Toast toast={toast} />
    </>
  )

  const TABS = [
    { id: 'mappa',     icon: '🗺️',  label: 'Mappa' },
    { id: 'segnala',   icon: '📍',  label: 'Segnala' },
    ...(isAdmin ? [{ id: 'dashboard', icon: '⚙️', label: 'Admin' }] : []),
    { id: 'profilo',   icon: '👤',  label: 'Profilo' },
  ]

  return (
    <AuthContext.Provider value={{ session, profile, isAdmin }}>
      <style>{STYLES}</style>
      <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}>

        {/* Top header */}
        <header style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, position: 'sticky', top: 0, zIndex: 900, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.png" style={{ width: 28, height: 28, borderRadius: 7, objectFit: "cover" }} alt="logo" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: 17 }}>Buche<span style={{ color: '#3b82f6' }}>Strade</span></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isAdmin && <span style={{ background: '#4c1d95', color: '#c4b5fd', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>👑 ADMIN</span>}
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: isAdmin ? '#7c3aed' : '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'white', fontWeight: 700 }}>
              {(profile?.nome || session.user.email || '?')[0].toUpperCase()}
            </div>
          </div>
        </header>

        <Toast toast={toast} />

        {/* Page content */}
        <div style={{ flex: 1 }}>
          {page === 'mappa'     && <MappaPage segnalazioni={segnalazioni} loading={loadingSeg} />}
          {page === 'segnala'   && <SegnalaPage segnalazioni={segnalazioni} onSubmit={s => setSegnalazioni(p => [s, ...p])} showToast={showToast} setPage={setPage} />}
          {page === 'dashboard' && isAdmin && <DashboardPage segnalazioni={segnalazioni} onUpdate={(id, u) => setSegnalazioni(p => p.map(s => s.id === id ? { ...s, ...u } : s))} showToast={showToast} />}
          {page === 'profilo'   && <ProfiloPage profile={profile} session={session} onLogout={handleLogout} />}
        </div>

        {/* Bottom tab bar */}
        <nav className="tab-bar">
          {TABS.map(tab => (
            <button key={tab.id} className="tab-btn" onClick={() => setPage(tab.id)}>
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label" style={{ color: page === tab.id ? '#3b82f6' : '#475569' }}>{tab.label}</span>
              {page === tab.id && <div style={{ width: 20, height: 3, background: '#3b82f6', borderRadius: 2, marginTop: 1 }} />}
            </button>
          ))}
        </nav>
      </div>
    </AuthContext.Provider>
  )
}

// ── AUTH PAGE ────────────────────────────────────────────────

function AuthPage({ showToast }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (!email || !password) { showToast('Compila email e password', 'error'); return }
    setLoading(true)
    try {
      if (mode === 'login') { await signInWithEmail(email, password) }
      else { await signUpWithEmail(email, password, nome); setDone(true) }
    } catch (e) {
      const m = e.message
      showToast(
        m.includes('Invalid login') ? 'Email o password errati' :
        m.includes('already registered') ? 'Email già registrata' :
        m.includes('Password should be') ? 'Password min. 6 caratteri' : m,
        'error'
      )
    } finally { setLoading(false) }
  }

  if (done) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>📧</div>
        <h2 style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Controlla la tua email</h2>
        <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.7 }}>Abbiamo inviato un link a <strong style={{ color: '#e2e8f0' }}>{email}</strong>. Clicca il link per attivare l'account.</p>
        <button className="btn-g" style={{ marginTop: 24 }} onClick={() => { setDone(false); setMode('login') }}>← Torna al login</button>
      </Card>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" style={{ width: 68, height: 68, borderRadius: 18, objectFit: "cover", margin: "0 auto 16px", display: "block" }} alt="logo" />
          <h1 style={{ color: 'white', fontSize: 28, fontWeight: 700 }}>Buche<span style={{ color: '#3b82f6' }}>Strade</span></h1>
          <p style={{ color: '#64748b', fontSize: 15, marginTop: 6 }}>Segnala le buche del tuo comune</p>
        </div>
        <Card>
          <div style={{ display: 'flex', background: '#0f172a', borderRadius: 12, padding: 4, marginBottom: 24 }}>
            {[['login','Accedi'],['signup','Registrati']].map(([m,l]) => (
              <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '10px 0', background: mode === m ? '#1e293b' : 'transparent', border: 'none', color: mode === m ? '#e2e8f0' : '#64748b', borderRadius: 9, cursor: 'pointer', fontWeight: mode === m ? 600 : 400, fontSize: 15, fontFamily: 'inherit', transition: 'all .15s', minHeight: 44 }}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 7 }}>Nome</label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Mario Rossi" />
              </div>
            )}
            <div>
              <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 7 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="mario@esempio.it" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 7 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            <button className="btn-p" onClick={handleSubmit} disabled={loading} style={{ marginTop: 4 }}>
              {loading ? <Spinner /> : mode === 'login' ? 'Accedi' : 'Crea account'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: '#334155' }} />
              <span style={{ color: '#475569', fontSize: 13 }}>oppure</span>
              <div style={{ flex: 1, height: 1, background: '#334155' }} />
            </div>
            <button className="btn-g" onClick={async () => { try { await signInWithGoogle() } catch (e) { showToast(e.message, 'error') } }}>
              <span>🔵</span> Continua con Google
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── PROFILO PAGE ─────────────────────────────────────────────

function ProfiloPage({ profile, session, onLogout }) {
  return (
    <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Il mio profilo</h1>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'white', fontWeight: 700, flexShrink: 0 }}>
            {(profile?.nome || session.user.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 17 }}>{profile?.nome || 'Utente'}</div>
            <div style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>{session.user.email}</div>
          </div>
        </div>
        <div style={{ background: '#0f172a', borderRadius: 10, padding: 14 }}>
          <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>Dettagli account</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#64748b', fontSize: 14 }}>Ruolo</span>
            <span style={{ background: profile?.role === 'admin' ? '#4c1d95' : profile?.role === 'supervisor' ? '#1e3a5f' : '#1e293b', color: profile?.role === 'admin' ? '#c4b5fd' : profile?.role === 'supervisor' ? '#7dd3fc' : '#94a3b8', padding: '2px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
              {profile?.role === 'admin' ? '👑 Admin' : profile?.role === 'supervisor' ? '🔷 Supervisor' : '👤 Utente'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: 14 }}>Membro dal</span>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('it-IT') : '—'}</span>
          </div>
        </div>
      </Card>
      <button className="btn-g" onClick={onLogout} style={{ borderColor: '#7f1d1d', color: '#fca5a5' }}>
        🚪 Esci dall'account
      </button>
    </div>
  )
}

// ── MAPPA PAGE ───────────────────────────────────────────────

function MappaPage({ segnalazioni, loading }) {
  const { isAdmin } = useAuth()
  const [filtroStato, setFiltroStato] = useState('tutti')
  const [filtroPerc, setFiltroPerc] = useState('tutti')
  const [selected, setSelected] = useState(null)
  const [showFiltri, setShowFiltri] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const userMarkerRef = useRef(null)
  const centeredRef = useRef(false)

  const visible = segnalazioni.filter(s =>
    (isAdmin || (s.foto_validata && s.stato !== 'rifiutata')) &&
    (filtroStato === 'tutti' || s.stato === filtroStato) &&
    (filtroPerc === 'tutti' || s.pericolosita === filtroPerc)
  )

  const stats = {
    totale: segnalazioni.filter(s => s.foto_validata).length,
    critiche: segnalazioni.filter(s => s.pericolosita === 'critica' && s.foto_validata).length,
    alte: segnalazioni.filter(s => s.pericolosita === 'alta' && s.foto_validata).length,
    risolte: segnalazioni.filter(s => s.stato === 'risolta').length,
  }

  const filtriAttivi = (filtroStato !== 'tutti' ? 1 : 0) + (filtroPerc !== 'tutti' ? 1 : 0)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const map = L.map(mapRef.current, { zoomControl: false }).setView([41.9028, 12.4964], 6)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OSM</a>'
    }).addTo(map)
    // Zoom control in alto a destra
    L.control.zoom({ position: 'topright' }).addTo(map)
    mapInstanceRef.current = map
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []
    visible.forEach(s => {
      const cfg = PERICOLOSITA_CONFIG[s.pericolosita]
      const icon = L.divIcon({
        html: `<div style="width:24px;height:24px;border-radius:50%;background:${cfg.color};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.5);cursor:pointer"></div>`,
        className: '', iconSize: [24, 24], iconAnchor: [12, 12]
      })
      const marker = L.marker([s.lat, s.lng], { icon }).addTo(map)
      marker.on('click', () => setSelected(s))
      markersRef.current.push(marker)
    })
    if (!centeredRef.current && markersRef.current.length > 0) {
      centeredRef.current = true
      map.fitBounds(L.featureGroup(markersRef.current).getBounds(), { padding: [50, 50], maxZoom: 15 })
    }
  }, [visible])

  const handleMyLocation = () => {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(({ coords: { latitude: lat, longitude: lng } }) => {
      const map = mapInstanceRef.current
      if (!map) return
      if (userMarkerRef.current) map.removeLayer(userMarkerRef.current)
      const icon = L.divIcon({
        html: `<div style="width:20px;height:20px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 5px rgba(59,130,246,0.3);animation:pulse 1.5s infinite"></div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10]
      })
      userMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map)
        .bindPopup('<b style="color:#1e293b">📍 Sei qui</b>').openPopup()
      map.setView([lat, lng], 15)
      setGpsLoading(false)
    }, () => setGpsLoading(false))
  }

  return (
    <div style={{ height: 'calc(100dvh - 52px - 56px - env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Stats strip — scrollabile orizzontalmente su mobile */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ color: '#64748b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}><Spinner /> Caricamento segnalazioni...</div>
        ) : (
          <>
            {[
              { label: 'Totale',   val: stats.totale,   color: '#3b82f6' },
              { label: 'Critiche', val: stats.critiche, color: '#ef4444' },
              { label: 'Alte',     val: stats.alte,     color: '#f97316' },
              { label: 'Risolte',  val: stats.risolte,  color: '#22c55e' },
            ].map(s => (
              <div key={s.label} style={{ background: '#1e293b', borderRadius: 8, padding: '6px 12px', display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ color: s.color, fontWeight: 700, fontSize: 18 }}>{s.val}</span>
                <span style={{ color: '#64748b', fontSize: 12 }}>{s.label}</span>
              </div>
            ))}
            {/* Pulsante filtri */}
            <button onClick={() => setShowFiltri(true)} className="btn-sm" style={{ marginLeft: 'auto', flexShrink: 0, background: filtriAttivi > 0 ? '#1e3a5f' : '#1e293b', color: filtriAttivi > 0 ? '#7dd3fc' : '#94a3b8', borderColor: filtriAttivi > 0 ? '#3b82f6' : '#334155' }}>
              🔧 Filtri {filtriAttivi > 0 && <span style={{ background: '#3b82f6', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{filtriAttivi}</span>}
            </button>
          </>
        )}
      </div>

      {/* Pulsante posizione — overlay sulla mappa */}
      <div style={{ position: 'absolute', bottom: 16, right: 12, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={handleMyLocation} disabled={gpsLoading}
          style={{ background: 'rgba(15,23,42,.92)', backdropFilter: 'blur(8px)', border: '1px solid #334155', color: gpsLoading ? '#64748b' : '#3b82f6', borderRadius: 12, padding: '10px 14px', cursor: gpsLoading ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 16px rgba(0,0,0,.4)', minHeight: 44, whiteSpace: 'nowrap' }}>
          {gpsLoading ? <><Spinner /> Ricerca...</> : <>📍 La mia posizione</>}
        </button>
      </div>

      {/* Legenda */}
      <div style={{ position: 'absolute', bottom: 16, left: 12, zIndex: 500, background: 'rgba(15,23,42,.92)', backdropFilter: 'blur(8px)', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px' }}>
        {Object.entries(PERICOLOSITA_CONFIG).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
            <span style={{ color: '#e2e8f0', fontSize: 12 }}>{v.label}</span>
          </div>
        ))}
      </div>

      <div ref={mapRef} style={{ flex: 1 }} />

      {/* Filtri — bottom sheet */}
      {showFiltri && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.6)' }} onClick={() => setShowFiltri(false)}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#1e293b', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', border: '1px solid #334155' }} className="slide-up" onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: '#334155', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700 }}>Filtri mappa</h3>
              {filtriAttivi > 0 && <button onClick={() => { setFiltroStato('tutti'); setFiltroPerc('tutti') }} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Azzera filtri</button>}
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Stato segnalazione</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[['tutti','Tutti'],['segnalata','Segnalata'],['in_lavorazione','In lavoro'],['risolta','Risolta']].map(([v,l]) => (
                    <button key={v} onClick={() => setFiltroStato(v)} style={{ padding: '11px 10px', borderRadius: 10, border: `2px solid ${filtroStato === v ? '#3b82f6' : '#334155'}`, background: filtroStato === v ? '#1e3a5f' : '#0f172a', color: filtroStato === v ? '#7dd3fc' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Pericolosità</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[['tutti','Tutte'],['bassa','🟢 Bassa'],['media','🟡 Media'],['alta','🟠 Alta'],['critica','🔴 Critica']].map(([v,l]) => (
                    <button key={v} onClick={() => setFiltroPerc(v)} style={{ padding: '11px 10px', borderRadius: 10, border: `2px solid ${filtroPerc === v ? PERICOLOSITA_CONFIG[v]?.color || '#3b82f6' : '#334155'}`, background: filtroPerc === v ? '#0f172a' : '#0f172a', color: filtroPerc === v ? (PERICOLOSITA_CONFIG[v]?.color || '#3b82f6') : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <button className="btn-p" style={{ marginTop: 20 }} onClick={() => setShowFiltri(false)}>Applica filtri</button>
          </div>
        </div>
      )}

      {/* Dettaglio buca — bottom sheet */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,.6)' }} onClick={() => setSelected(null)}>
          <div style={{ background: '#1e293b', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', width: '100%', maxWidth: 540, margin: '0 auto', border: '1px solid #334155', maxHeight: '75dvh', overflowY: 'auto' }} className="slide-up" onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: '#334155', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15, marginBottom: 4, lineHeight: 1.4 }}>{selected.address}</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>{new Date(selected.created_at).toLocaleDateString('it-IT')} · {selected.segnalante_nome || selected.profiles?.nome || 'Utente'}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: '#0f172a', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, padding: 8, borderRadius: 8, flexShrink: 0 }}>✕</button>
            </div>
            {selected.foto_url
              ? <img src={selected.foto_url} alt="Buca" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 12, marginBottom: 14 }} />
              : <div style={{ width: '100%', height: 100, background: '#0f172a', borderRadius: 12, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🕳️</div>
            }
            <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
              <Badge cfg={PERICOLOSITA_CONFIG[selected.pericolosita]}>⚠️ {PERICOLOSITA_CONFIG[selected.pericolosita].label}</Badge>
              <Badge cfg={STATO_CONFIG[selected.stato]}>{STATO_CONFIG[selected.stato].label}</Badge>
              {selected.foto_validata && <Badge cfg={{ bg: '#1e1b4b', text: '#818cf8' }}>🤖 AI</Badge>}
            </div>
            {selected.descrizione && <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>{selected.descrizione}</p>}
            {selected.note_comune && (
              <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid #3b82f6' }}>
                <div style={{ color: '#3b82f6', fontSize: 11, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>Note del Comune</div>
                <div style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>{selected.note_comune}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── SEGNALA PAGE ─────────────────────────────────────────────

function SegnalaPage({ segnalazioni, onSubmit, showToast, setPage }) {
  const { session, profile } = useAuth()
  const [step, setStep] = useState(1)
  const [foto, setFoto] = useState(null)
  const [fotoUrl, setFotoUrl] = useState(null)
  const [position, setPosition] = useState(null)
  const [address, setAddress] = useState('')
  const [pericolosita, setPericolosita] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [dupAlert, setDupAlert] = useState(null)
  const mapRef2 = useRef(null)
  const mapInstanceRef2 = useRef(null)
  const markerRef2 = useRef(null)

  const handleFoto = e => {
    const file = e.target.files[0]
    if (!file) return
    setFoto(file)
    setFotoUrl(URL.createObjectURL(file))
  }

  useEffect(() => {
    if (step !== 2 || !mapRef2.current || mapInstanceRef2.current) return
    const map = L.map(mapRef2.current, { zoomControl: false }).setView([41.9028, 12.4964], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
    mapInstanceRef2.current = map
    map.on('click', async ({ latlng: { lat, lng } }) => {
      setPosition({ lat, lng })
      if (markerRef2.current) map.removeLayer(markerRef2.current)
      markerRef2.current = L.marker([lat, lng]).addTo(map)
      await reverseGeocode(lat, lng)
      setDupAlert(checkDuplicatiPos({ lat, lng }))
    })
  }, [step])

  const reverseGeocode = async (lat, lng) => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      setAddress((await r.json()).display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } catch { setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`) }
  }

  const handleGPS = () => {
    if (!navigator.geolocation) { showToast('GPS non disponibile', 'error'); return }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(async ({ coords: { latitude: lat, longitude: lng } }) => {
      setPosition({ lat, lng })
      const map = mapInstanceRef2.current
      if (map) {
        if (markerRef2.current) map.removeLayer(markerRef2.current)
        markerRef2.current = L.marker([lat, lng]).addTo(map)
        map.setView([lat, lng], 16)
      }
      await reverseGeocode(lat, lng)
      setDupAlert(checkDuplicatiPos({ lat, lng }))
      setLoading(false)
    }, () => { showToast('GPS non disponibile', 'error'); setLoading(false) })
  }

  const checkDuplicatiPos = pos => {
    if (!pos) return null
    const toRad = d => d * Math.PI / 180
    const dist = s => {
      const R = 6371000, dLat = toRad(s.lat - pos.lat), dLng = toRad(s.lng - pos.lng)
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(pos.lat)) * Math.cos(toRad(s.lat)) * Math.sin(dLng/2)**2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }
    return segnalazioni.find(s => s.stato !== 'risolta' && s.stato !== 'rifiutata' && dist(s) <= 50)
  }

  const analyzeWithAI = async () => {
    // Senza foto blocca sempre — la foto è obbligatoria per la validazione
    if (!foto) return {
      valid: false,
      result: { valida: false, messaggio: 'La foto è obbligatoria per inviare una segnalazione.' }
    }
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(foto)
      })
      const resp = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: foto.type || 'image/jpeg' })
      })
      if (!resp.ok) {
        // Errore HTTP → blocca sempre
        return { valid: false, result: { valida: false, messaggio: 'Errore di rete durante la validazione. Riprova.' } }
      }
      const p = await resp.json()
      // Valido solo se il server dice esplicitamente valida: true
      return { valid: p.valida === true, result: p }
    } catch {
      // Qualsiasi errore (rete, parsing, ecc.) → blocca sempre, non passare mai
      return {
        valid: false,
        result: { valida: false, messaggio: 'Validazione AI non raggiungibile. Controlla la connessione e riprova.' }
      }
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const ai = await analyzeWithAI()
      setAiResult(ai)
      if (!ai.valid) { showToast('❌ ' + (ai.result?.messaggio || 'Foto non valida'), 'error'); setLoading(false); return }
      const foto_url = foto ? await uploadFoto(foto, session.user.id) : null
      const nuova = await insertSegnalazione({
        user_id: session.user.id, lat: position.lat, lng: position.lng,
        address, pericolosita, stato: 'segnalata',
        descrizione, foto_url, foto_validata: ai.valid,
        note_comune: '', segnalante_nome: profile?.nome || session.user.email,
      })
      onSubmit(nuova)
      showToast('✅ Segnalazione inviata!', 'success')
      setStep(1); setFoto(null); setFotoUrl(null); setPosition(null); setAddress(''); setPericolosita(''); setDescrizione(''); setAiResult(null)
      setPage('mappa')
    } catch (e) { showToast('Errore: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const STEPS = ['Foto', 'Posizione', 'Pericolo', 'Invia']

  return (
    <div style={{ minHeight: 'calc(100dvh - 52px - 56px)', background: '#0f172a', padding: '20px 16px 32px' }}>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Segnala una buca</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>Aiuta il tuo comune a migliorare le strade</p>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: step > i+1 ? '#22c55e' : step === i+1 ? '#3b82f6' : '#1e293b', border: `2px solid ${step > i+1 ? '#22c55e' : step === i+1 ? '#3b82f6' : '#334155'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: step >= i+1 ? 'white' : '#475569', fontWeight: 700, fontSize: 13, transition: 'all .3s' }}>
                  {step > i+1 ? '✓' : i+1}
                </div>
                <span style={{ color: step === i+1 ? '#3b82f6' : '#475569', fontSize: 10, marginTop: 4, whiteSpace: 'nowrap', fontWeight: step === i+1 ? 600 : 400 }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: step > i+1 ? '#22c55e' : '#334155', margin: '0 4px', marginBottom: 18, transition: 'all .3s' }} />}
            </div>
          ))}
        </div>

        <Card className="fade-in">
          {/* Step 1 */}
          {step === 1 && (
            <div>
              <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>📷 Carica una foto</h2>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 18, lineHeight: 1.5 }}>Scatta una foto della buca. La foto verrà analizzata dall'AI.</p>
              <label style={{ display: 'block', border: `2px dashed ${fotoUrl ? '#22c55e' : '#334155'}`, borderRadius: 14, cursor: 'pointer', overflow: 'hidden', minHeight: fotoUrl ? 0 : 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{ display: 'none' }} />
                {fotoUrl
                  ? <div style={{ width: '100%' }}><img src={fotoUrl} alt="Preview" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} /><div style={{ padding: '12px', color: '#22c55e', fontSize: 14, fontWeight: 600, background: '#052e16', textAlign: 'center' }}>✓ Foto caricata — tocca per cambiare</div></div>
                  : <div style={{ textAlign: 'center', padding: 32 }}><div style={{ fontSize: 52, marginBottom: 12 }}>📷</div><div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Tocca per scattare o caricare</div><div style={{ color: '#64748b', fontSize: 13 }}>JPG, PNG, WebP</div></div>
                }
              </label>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700, marginBottom: 14 }}>📍 Posizione della buca</h2>
              <button onClick={handleGPS} className="btn-p" disabled={loading} style={{ marginBottom: 14 }}>
                {loading ? <><Spinner /> Rilevamento GPS...</> : '📡 Usa la mia posizione GPS'}
              </button>
              <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>— oppure tocca sulla mappa —</div>
              <div ref={mapRef2} style={{ height: 220, borderRadius: 12, marginBottom: 12, border: '1px solid #334155', overflow: 'hidden' }} />
              {address && (
                <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px 14px', color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
                  📍 {address}
                </div>
              )}
              {dupAlert && (
                <div style={{ background: '#451a03', border: '1.5px solid #f97316', borderRadius: 10, padding: '14px', marginTop: 12 }}>
                  <div style={{ color: '#fb923c', fontWeight: 700, marginBottom: 5, fontSize: 14 }}>⚠️ Possibile duplicato rilevato</div>
                  <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>Esiste già una segnalazione entro 50m: "{dupAlert.address}" · <strong>{STATO_CONFIG[dupAlert.stato]?.label}</strong></div>
                </div>
              )}
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>⚠️ Livello di pericolosità</h2>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 18 }}>Quanto è pericolosa questa buca?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { k: 'bassa',   e: '🟢', d: 'Piccola buca, disagio minimo' },
                  { k: 'media',   e: '🟡', d: 'Buca evidente, rischio su due ruote' },
                  { k: 'alta',    e: '🟠', d: 'Buca profonda, pericolo concreto' },
                  { k: 'critica', e: '🔴', d: 'Buca grave, urgente intervento' },
                ].map(opt => (
                  <button key={opt.k} onClick={() => setPericolosita(opt.k)}
                    style={{ background: pericolosita === opt.k ? '#0f172a' : '#0f172a', border: `2px solid ${pericolosita === opt.k ? PERICOLOSITA_CONFIG[opt.k].color : '#334155'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all .15s', fontFamily: 'inherit', textAlign: 'left', minHeight: 64 }}>
                    <span style={{ fontSize: 26 }}>{opt.e}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: PERICOLOSITA_CONFIG[opt.k].color, fontWeight: 700, fontSize: 15 }}>{PERICOLOSITA_CONFIG[opt.k].label}</div>
                      <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>{opt.d}</div>
                    </div>
                    {pericolosita === opt.k && <span style={{ color: PERICOLOSITA_CONFIG[opt.k].color, fontSize: 20 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div>
              <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>📝 Dettagli finali</h2>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 14 }}>Aggiungi dettagli utili (opzionale)</p>
              <textarea value={descrizione} onChange={e => setDescrizione(e.target.value)} placeholder="Es: buca vicino all'incrocio, pericolosa per moto..." style={{ marginBottom: 16 }} />
              {aiResult && (
                <div style={{ background: aiResult.valid ? '#052e16' : '#450a0a', border: `1.5px solid ${aiResult.valid ? '#22c55e' : '#ef4444'}`, borderRadius: 10, padding: '14px', marginBottom: 16 }}>
                  <div style={{ color: aiResult.valid ? '#22c55e' : '#ef4444', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                    {aiResult.valid ? '✅ Foto validata — mostra una buca stradale reale' : '❌ Foto non accettata'}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>{aiResult.result?.messaggio}</div>
                  {!aiResult.valid && (
                    <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(0,0,0,.3)', borderRadius: 8 }}>
                      <div style={{ color: '#f87171', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>⛔ La segnalazione non verrà inviata.</div>
                      <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>Torna allo step 1 e carica una foto che mostri chiaramente una buca o un danno al manto stradale, senza persone visibili.</div>
                    </div>
                  )}
                </div>
              )}
              {/* Riepilogo */}
              <div style={{ background: '#0f172a', borderRadius: 12, padding: 16 }}>
                <div style={{ color: '#475569', fontSize: 11, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.5px' }}>Riepilogo segnalazione</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ color: '#64748b', fontSize: 14, flexShrink: 0 }}>Indirizzo</span>
                    <span style={{ color: '#94a3b8', fontSize: 13, textAlign: 'right', lineHeight: 1.4 }}>{address || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: 14 }}>Pericolosità</span>
                    {pericolosita && <Badge cfg={PERICOLOSITA_CONFIG[pericolosita]}>{PERICOLOSITA_CONFIG[pericolosita].label}</Badge>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontSize: 14 }}>Foto</span>
                    <span style={{ color: foto ? '#22c55e' : '#ef4444', fontSize: 14, fontWeight: 600 }}>{foto ? '✓ Caricata' : '✗ Mancante'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigazione step */}
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            {step > 1 && <button onClick={() => setStep(s => s - 1)} className="btn-g" style={{ flex: 1 }}>← Indietro</button>}
            {step < 4 && (
              <button className="btn-p" style={{ flex: 2 }} onClick={() => {
                if (step === 1 && !foto) { showToast('Carica una foto prima di procedere', 'error'); return }
                if (step === 2 && !position) { showToast('Seleziona la posizione sulla mappa', 'error'); return }
                if (step === 3 && !pericolosita) { showToast('Seleziona il livello di pericolosità', 'error'); return }
                setStep(s => s + 1)
              }}>Avanti →</button>
            )}
            {step === 4 && (
              <button className="btn-p" style={{ flex: 2 }} onClick={handleSubmit} disabled={loading}>
                {loading ? <><Spinner /> Invio in corso...</> : '📤 Invia segnalazione'}
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── DASHBOARD PAGE ───────────────────────────────────────────

function DashboardPage({ segnalazioni, onUpdate, showToast }) {
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState('tutti')
  const [filtroPerc, setFiltroPerc] = useState('tutti')
  const [editing, setEditing] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)

  const filtered = segnalazioni.filter(s =>
    (filtroStato === 'tutti' || s.stato === filtroStato) &&
    (filtroPerc === 'tutti' || s.pericolosita === filtroPerc) &&
    (!search || s.address?.toLowerCase().includes(search.toLowerCase()) ||
     s.descrizione?.toLowerCase().includes(search.toLowerCase()) ||
     s.segnalante_nome?.toLowerCase().includes(search.toLowerCase()))
  )

  const agg = {
    totale: segnalazioni.length,
    critiche: segnalazioni.filter(s => s.pericolosita === 'critica').length,
    in_lavorazione: segnalazioni.filter(s => s.stato === 'in_lavorazione').length,
    risolte: segnalazioni.filter(s => s.stato === 'risolta').length,
    validate: segnalazioni.filter(s => s.foto_validata).length,
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const updated = await updateSegnalazione(editing.id, editData)
      onUpdate(editing.id, updated)
      showToast('✅ Aggiornata con successo', 'success')
      setEditing(null)
    } catch (e) { showToast('Errore: ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ minHeight: 'calc(100dvh - 52px - 56px)', background: '#0f172a', padding: '20px 16px 32px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Dashboard Comune</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>Gestione e monitoraggio segnalazioni</p>
        </div>

        {/* Stats — scrollabili su mobile */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
          {[
            { label: 'Totali', val: agg.totale, color: '#3b82f6', icon: '📋' },
            { label: 'Critiche', val: agg.critiche, color: '#ef4444', icon: '🔴' },
            { label: 'In lavoro', val: agg.in_lavorazione, color: '#f59e0b', icon: '🔧' },
            { label: 'Risolte', val: agg.risolte, color: '#22c55e', icon: '✅' },
            { label: 'AI validate', val: agg.validate, color: '#8b5cf6', icon: '🤖' },
          ].map(s => (
            <div key={s.label} style={{ background: '#1e293b', borderRadius: 12, padding: '14px 16px', border: '1px solid #334155', flexShrink: 0, minWidth: 110 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ color: s.color, fontSize: 22, fontWeight: 700 }}>{s.val}</span>
              </div>
              <div style={{ color: '#64748b', fontSize: 12 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filtri */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cerca per indirizzo, descrizione, utente..." />
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)} style={{ flex: 1 }}>
              <option value="tutti">Tutti gli stati</option>
              {Object.entries(STATO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filtroPerc} onChange={e => setFiltroPerc(e.target.value)} style={{ flex: 1 }}>
              <option value="tutti">Tutti i livelli</option>
              {Object.entries(PERICOLOSITA_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ color: '#475569', fontSize: 13, marginBottom: 12 }}>{filtered.length} segnalazioni trovate</div>

        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(s => (
            <div key={s.id} style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 0 }}>
                {/* Foto */}
                <div style={{ width: 80, flexShrink: 0, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                  {s.foto_url ? <img src={s.foto_url} alt="" style={{ width: 80, height: '100%', minHeight: 80, objectFit: 'cover' }} /> : '🕳️'}
                </div>
                {/* Info */}
                <div style={{ flex: 1, padding: '12px 12px 12px 14px', minWidth: 0 }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address}</div>
                  <div style={{ color: '#475569', fontSize: 12, marginBottom: 8 }}>{new Date(s.created_at).toLocaleDateString('it-IT')} · {s.segnalante_nome || s.profiles?.nome || 'Utente'}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Badge cfg={PERICOLOSITA_CONFIG[s.pericolosita]}>⚠️ {PERICOLOSITA_CONFIG[s.pericolosita]?.label}</Badge>
                    <Badge cfg={STATO_CONFIG[s.stato]}>{STATO_CONFIG[s.stato]?.label}</Badge>
                  </div>
                </div>
              </div>
              {/* Action bar */}
              <div style={{ borderTop: '1px solid #334155', padding: '10px 14px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                {s.foto_validata && <span style={{ color: '#818cf8', fontSize: 12, alignSelf: 'center', marginRight: 'auto' }}>🤖 AI validata</span>}
                <button onClick={() => { setEditing(s); setEditData({ stato: s.stato, pericolosita: s.pericolosita, foto_validata: s.foto_validata, note_comune: s.note_comune || '' }) }} className="btn-sm">
                  ✏️ Modifica
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#475569' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 15 }}>Nessuna segnalazione trovata</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal modifica — bottom sheet */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setEditing(null)}>
          <div style={{ background: '#1e293b', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', width: '100%', maxWidth: 540, margin: '0 auto', border: '1px solid #334155', maxHeight: '88dvh', overflowY: 'auto' }} className="slide-up" onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: '#334155', borderRadius: 2, margin: '0 auto 18px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 700 }}>Modifica segnalazione</h3>
              <button onClick={() => setEditing(null)} style={{ background: '#0f172a', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, padding: 8, borderRadius: 8 }}>✕</button>
            </div>
            {editing.foto_url && <img src={editing.foto_url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 12, marginBottom: 14 }} />}
            <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px 14px', marginBottom: 18, color: '#94a3b8', fontSize: 14, lineHeight: 1.5 }}>📍 {editing.address}</div>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Stato</label>
                <select value={editData.stato} onChange={e => setEditData(d => ({ ...d, stato: e.target.value }))}>
                  {Object.entries(STATO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Pericolosità</label>
                <select value={editData.pericolosita} onChange={e => setEditData(d => ({ ...d, pericolosita: e.target.value }))}>
                  {Object.entries(PERICOLOSITA_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', background: '#0f172a', borderRadius: 10 }}>
                <input type="checkbox" id="val" checked={editData.foto_validata} onChange={e => setEditData(d => ({ ...d, foto_validata: e.target.checked }))} style={{ width: 20, height: 20, accentColor: '#3b82f6', flexShrink: 0 }} />
                <label htmlFor="val" style={{ color: '#94a3b8', fontSize: 15, cursor: 'pointer', lineHeight: 1.4 }}>Foto validata manualmente</label>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Note ufficiali del comune</label>
                <textarea value={editData.note_comune} onChange={e => setEditData(d => ({ ...d, note_comune: e.target.value }))} placeholder="Inserisci note ufficiali per il cittadino..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => setEditing(null)} className="btn-g" style={{ flex: 1 }}>Annulla</button>
              <button onClick={saveEdit} className="btn-p" disabled={saving} style={{ flex: 2 }}>
                {saving ? <Spinner /> : '💾 Salva modifiche'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
