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

// ── CONSTANTS ────────────────────────────────────────────────

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

// ── AUTH CONTEXT ─────────────────────────────────────────────

const AuthContext = createContext(null)
const useAuth = () => useContext(AuthContext)

// ── GLOBAL STYLES ────────────────────────────────────────────

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans','Segoe UI',sans-serif;background:#0f172a}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#1e293b}::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 4px rgba(59,130,246,0.3)}50%{box-shadow:0 0 0 8px rgba(59,130,246,0.1)}}
.fade-in{animation:fadeIn .2s ease}
.spin{animation:spin 1s linear infinite;display:inline-block}
.btn-p{background:#3b82f6;color:#fff;border:none;padding:11px 20px;border-radius:9px;cursor:pointer;font-weight:600;font-size:14px;font-family:inherit;transition:all .15s;width:100%}
.btn-p:hover:not(:disabled){background:#2563eb}
.btn-p:disabled{background:#334155;color:#64748b;cursor:default}
.btn-g{background:transparent;color:#94a3b8;border:1px solid #334155;padding:10px 18px;border-radius:9px;cursor:pointer;font-weight:500;font-size:14px;font-family:inherit;transition:all .15s;width:100%}
.btn-g:hover{background:#1e293b;color:#e2e8f0}
.btn-danger{background:#7f1d1d;color:#fca5a5;border:none;padding:10px 18px;border-radius:9px;cursor:pointer;font-weight:600;font-size:14px;font-family:inherit;width:100%}
.btn-danger:hover{background:#991b1b}
input[type=text],input[type=email],input[type=password],input[type=number],textarea,select{background:#1e293b;border:1px solid #334155;color:#e2e8f0;padding:10px 14px;border-radius:8px;width:100%;font-size:14px;outline:none;transition:border .15s;font-family:inherit}
input:focus,textarea:focus,select:focus{border-color:#3b82f6}
textarea{resize:vertical;min-height:80px}
select option{background:#1e293b}
`

// ── SHARED COMPONENTS ────────────────────────────────────────

function Badge({ cfg, children }) {
  return <span style={{ background: cfg.bg, color: cfg.text, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{children}</span>
}

function Spinner() {
  return <span className="spin" style={{ fontSize: 18 }}>⟳</span>
}

function Toast({ toast }) {
  if (!toast) return null
  const map = { success: ['#065f46', '#10b981'], error: ['#7f1d1d', '#ef4444'], info: ['#1e3a5f', '#3b82f6'] }
  const [bg, border] = map[toast.type] || map.info
  return (
    <div style={{ position: 'fixed', top: 66, right: 16, zIndex: 9999, background: bg, border: `1px solid ${border}`, color: 'white', padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 500, maxWidth: 340, animation: 'fadeIn .2s ease', lineHeight: 1.4 }}>
      {toast.msg}
    </div>
  )
}

function Card({ children, style }) {
  return <div style={{ background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155', ...style }}>{children}</div>
}

// ── ROOT APP ─────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)
  const [page, setPage] = useState('mappa')
  const [segnalazioni, setSegnalazioni] = useState([])
  const [loadingSeg, setLoadingSeg] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load profile when session changes
  useEffect(() => {
    if (!session) { setProfile(null); return }
    getProfile(session.user.id).then(setProfile).catch(console.error)
  }, [session])

  // Load segnalazioni
  const loadSegnalazioni = async () => {
    setLoadingSeg(true)
    try {
      const data = await getSegnalazioni()
      setSegnalazioni(data || [])
    } catch (e) {
      showToast('Errore nel caricamento segnalazioni', 'error')
    } finally {
      setLoadingSeg(false)
    }
  }

  useEffect(() => {
    if (session) loadSegnalazioni()
  }, [session])

  // Real-time updates
  useEffect(() => {
    if (!session) return
    const channel = supabase
      .channel('segnalazioni-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'segnalazioni' }, () => loadSegnalazioni())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [session])

  const handleLogout = async () => {
    await signOut()
    setPage('mappa')
    setSegnalazioni([])
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'supervisor'

  // Loading state
  if (session === undefined) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <style>{STYLES}</style>
        <div style={{ fontSize: 40 }}>🕳️</div>
        <div style={{ color: '#64748b', fontSize: 15 }}>Caricamento...</div>
      </div>
    )
  }

  // Not logged in → show auth page
  if (!session) {
    return (
      <>
        <style>{STYLES}</style>
        <AuthPage onSuccess={() => {}} showToast={showToast} />
        <Toast toast={toast} />
      </>
    )
  }

  return (
    <AuthContext.Provider value={{ session, profile, isAdmin }}>
      <style>{STYLES}</style>
      <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex', flexDirection: 'column' }}>

        {/* NAVBAR */}
        <nav style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, height: 54, position: 'sticky', top: 0, zIndex: 1000 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
            <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg,#3b82f6,#06b6d4)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🕳️</div>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Buche<span style={{ color: '#3b82f6' }}>Strade</span></span>
          </div>
          <div style={{ display: 'flex', gap: 2, flex: 1 }}>
            {[
              { id: 'mappa', label: '🗺️ Mappa' },
              { id: 'segnala', label: '📍 Segnala' },
              ...(isAdmin ? [{ id: 'dashboard', label: '⚙️ Admin' }] : [])
            ].map(tab => (
              <button key={tab.id} onClick={() => setPage(tab.id)}
                style={{ background: page === tab.id ? '#1e293b' : 'transparent', border: 'none', color: page === tab.id ? '#3b82f6' : '#64748b', padding: '6px 10px', borderRadius: 7, cursor: 'pointer', fontWeight: page === tab.id ? 600 : 400, fontSize: 13, fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap' }}>
                {tab.label}
              </button>
            ))}
          </div>
          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', borderRadius: 8, padding: '5px 10px' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: isAdmin ? '#7c3aed' : '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white', fontWeight: 700 }}>
                {(profile?.nome || session.user.email || '?')[0].toUpperCase()}
              </div>
              <span style={{ color: '#94a3b8', fontSize: 12, display: 'none' }} className="md-show">
                {isAdmin ? '👑 ' : ''}{profile?.role || 'user'}
              </span>
            </div>
            <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #334155', color: '#64748b', padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
              Esci
            </button>
          </div>
        </nav>

        <Toast toast={toast} />

        <div style={{ flex: 1 }}>
          {page === 'mappa' && <MappaPage segnalazioni={segnalazioni} loading={loadingSeg} />}
          {page === 'segnala' && <SegnalaPage segnalazioni={segnalazioni} onSubmit={async (s) => { setSegnalazioni(prev => [s, ...prev]) }} showToast={showToast} setPage={setPage} />}
          {page === 'dashboard' && isAdmin && <DashboardPage segnalazioni={segnalazioni} onUpdate={(id, updates) => setSegnalazioni(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))} showToast={showToast} />}
        </div>
      </div>
    </AuthContext.Provider>
  )
}

// ── AUTH PAGE ────────────────────────────────────────────────

function AuthPage({ showToast }) {
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (!email || !password) { showToast('Compila email e password', 'error'); return }
    setLoading(true)
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password, nome)
        setDone(true)
      }
    } catch (e) {
      showToast(translateError(e.message), 'error')
    } finally {
      setLoading(false)
    }
  }

  const translateError = (msg) => {
    if (msg.includes('Invalid login')) return 'Email o password errati'
    if (msg.includes('already registered')) return 'Email già registrata — prova ad accedere'
    if (msg.includes('Password should be')) return 'La password deve avere almeno 6 caratteri'
    if (msg.includes('Unable to validate')) return 'Email non valida'
    return msg
  }

  if (done) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
        <h2 style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Controlla la tua email</h2>
        <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>Abbiamo inviato un link di conferma a <strong style={{ color: '#e2e8f0' }}>{email}</strong>. Clicca il link per attivare il tuo account.</p>
        <button className="btn-g" style={{ marginTop: 20 }} onClick={() => { setDone(false); setMode('login') }}>← Vai al login</button>
      </Card>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, background: 'linear-gradient(135deg,#3b82f6,#06b6d4)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 16px' }}>🕳️</div>
          <h1 style={{ color: 'white', fontSize: 26, fontWeight: 700 }}>Buche<span style={{ color: '#3b82f6' }}>Strade</span></h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Segnala le buche del tuo comune</p>
        </div>

        <Card>
          {/* Tabs */}
          <div style={{ display: 'flex', background: '#0f172a', borderRadius: 10, padding: 4, marginBottom: 24 }}>
            {[['login', 'Accedi'], ['signup', 'Registrati']].map(([m, l]) => (
              <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '8px 0', background: mode === m ? '#1e293b' : 'transparent', border: 'none', color: mode === m ? '#e2e8f0' : '#64748b', borderRadius: 8, cursor: 'pointer', fontWeight: mode === m ? 600 : 400, fontSize: 14, fontFamily: 'inherit', transition: 'all .15s' }}>{l}</button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mode === 'signup' && (
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome</label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Mario Rossi" />
              </div>
            )}
            <div>
              <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="mario@esempio.it" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>

            <button className="btn-p" onClick={handleSubmit} disabled={loading} style={{ marginTop: 4 }}>
              {loading ? <Spinner /> : mode === 'login' ? 'Accedi' : 'Crea account'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#334155' }} />
              <span style={{ color: '#475569', fontSize: 12 }}>oppure</span>
              <div style={{ flex: 1, height: 1, background: '#334155' }} />
            </div>

            <button className="btn-g" onClick={async () => { try { await signInWithGoogle() } catch (e) { showToast(e.message, 'error') } }}>
              <span style={{ marginRight: 8 }}>🔵</span> Continua con Google
            </button>
          </div>
        </Card>

        <p style={{ color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
          Accedendo accetti i termini di servizio.<br />I tuoi dati sono protetti e usati solo per gestire le segnalazioni.
        </p>
      </div>
    </div>
  )
}

// ── MAPPA PAGE ───────────────────────────────────────────────

function MappaPage({ segnalazioni, loading }) {
  const { isAdmin } = useAuth()
  const [filtroStato, setFiltroStato] = useState('tutti')
  const [filtroPerc, setFiltroPerc] = useState('tutti')
  const [selected, setSelected] = useState(null)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const userMarkerRef = useRef(null)
  const [gpsLoading, setGpsLoading] = useState(false)

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

  const centeredRef = useRef(false)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    // Vista iniziale sull'Italia, verrà aggiornata dai marker reali
    const map = L.map(mapRef.current).setView([41.9028, 12.4964], 6)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>'
    }).addTo(map)
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
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${cfg.color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:pointer"></div>`,
        className: '', iconSize: [22, 22], iconAnchor: [11, 11]
      })
      const marker = L.marker([s.lat, s.lng], { icon }).addTo(map)
      marker.on('click', () => setSelected(s))
      markersRef.current.push(marker)
    })
    // Prima volta che arrivano i dati: centra la mappa su tutti i marker
    if (!centeredRef.current && markersRef.current.length > 0) {
      centeredRef.current = true
      const group = L.featureGroup(markersRef.current)
      map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 })
    }
  }, [visible])

  const handleMyLocation = () => {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(({ coords: { latitude: lat, longitude: lng } }) => {
      const map = mapInstanceRef.current
      if (!map) return
      // Rimuovi marker utente precedente
      if (userMarkerRef.current) map.removeLayer(userMarkerRef.current)
      // Crea marker blu pulsante per la posizione utente
      const icon = L.divIcon({
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3);animation:pulse 1.5s infinite"></div>`,
        className: '', iconSize: [18, 18], iconAnchor: [9, 9]
      })
      userMarkerRef.current = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup('<div style="color:#1e293b;font-weight:600;font-size:13px">📍 La tua posizione</div>')
        .openPopup()
      map.setView([lat, lng], 15)
      setGpsLoading(false)
    }, () => setGpsLoading(false))
  }

  return (
    <div style={{ height: 'calc(100dvh - 54px)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Stats */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        {loading ? (
          <div style={{ color: '#64748b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><Spinner /> Caricamento...</div>
        ) : (
          <>
            {[
              { label: 'Totale', val: stats.totale, color: '#3b82f6' },
              { label: 'Critiche', val: stats.critiche, color: '#ef4444' },
              { label: 'Alte', val: stats.alte, color: '#f97316' },
              { label: 'Risolte', val: stats.risolte, color: '#22c55e' },
            ].map(s => (
              <div key={s.label} style={{ background: '#1e293b', borderRadius: 8, padding: '6px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: s.color, fontWeight: 700, fontSize: 18 }}>{s.val}</span>
                <span style={{ color: '#64748b', fontSize: 12 }}>{s.label}</span>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)} style={{ width: 'auto', padding: '7px 10px', fontSize: 12 }}>
                <option value="tutti">Tutti gli stati</option>
                {Object.entries(STATO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={filtroPerc} onChange={e => setFiltroPerc(e.target.value)} style={{ width: 'auto', padding: '7px 10px', fontSize: 12 }}>
                <option value="tutti">Tutti i livelli</option>
                {Object.entries(PERICOLOSITA_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Legenda */}
      <div style={{ position: 'absolute', bottom: 24, left: 12, zIndex: 500, background: 'rgba(15,23,42,.92)', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px' }}>
        <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Pericolosità</div>
        {Object.entries(PERICOLOSITA_CONFIG).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: v.color }} />
            <span style={{ color: '#e2e8f0', fontSize: 12 }}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Bottone posizione utente */}
      <div style={{ position: 'absolute', top: 70, right: 12, zIndex: 500 }}>
        <button onClick={handleMyLocation} disabled={gpsLoading}
          style={{ background: gpsLoading ? '#1e293b' : '#0f172a', border: '1px solid #334155', color: gpsLoading ? '#64748b' : '#3b82f6', borderRadius: 10, padding: '8px 14px', cursor: gpsLoading ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 12px rgba(0,0,0,.4)', transition: 'all .15s', backdropFilter: 'blur(8px)' }}>
          {gpsLoading ? <><span className="spin" style={{fontSize:14}}>⟳</span> Ricerca...</> : <>📍 La mia posizione</>}
        </button>
      </div>

      <div ref={mapRef} style={{ flex: 1 }} />

      {/* Dettaglio modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,.6)' }} onClick={() => setSelected(null)}>
          <div style={{ background: '#1e293b', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxWidth: 520, border: '1px solid #334155', maxHeight: '70dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: '#334155', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{selected.address}</div>
                <div style={{ color: '#64748b', fontSize: 12 }}>{new Date(selected.created_at).toLocaleDateString('it-IT')} · {selected.segnalante_nome || selected.profiles?.nome || 'Utente'}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20, padding: 4 }}>✕</button>
            </div>
            {selected.foto_url
              ? <img src={selected.foto_url} alt="Buca" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 10, marginBottom: 14 }} />
              : <div style={{ width: '100%', height: 100, background: '#0f172a', borderRadius: 10, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🕳️</div>
            }
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <Badge cfg={PERICOLOSITA_CONFIG[selected.pericolosita]}>⚠️ {PERICOLOSITA_CONFIG[selected.pericolosita].label}</Badge>
              <Badge cfg={STATO_CONFIG[selected.stato]}>{STATO_CONFIG[selected.stato].label}</Badge>
              {selected.foto_validata && <Badge cfg={{ bg: '#1e1b4b', text: '#818cf8' }}>🤖 AI validata</Badge>}
            </div>
            {selected.descrizione && <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 10 }}>{selected.descrizione}</p>}
            {selected.note_comune && (
              <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', borderLeft: '3px solid #3b82f6' }}>
                <div style={{ color: '#3b82f6', fontSize: 11, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' }}>Note del Comune</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>{selected.note_comune}</div>
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

  const handleFoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFoto(file)
    setFotoUrl(URL.createObjectURL(file))
  }

  useEffect(() => {
    if (step !== 2 || !mapRef2.current || mapInstanceRef2.current) return
    const map = L.map(mapRef2.current).setView([41.9028, 12.4964], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
    mapInstanceRef2.current = map
    map.on('click', async ({ latlng: { lat, lng } }) => {
      setPosition({ lat, lng })
      if (markerRef2.current) map.removeLayer(markerRef2.current)
      markerRef2.current = L.marker([lat, lng]).addTo(map)
      await reverseGeocode(lat, lng)
      // Controllo duplicati in tempo reale al click sulla mappa
      setDupAlert(checkDuplicatiPos({ lat, lng }))
    })
  }, [step])

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      const data = await res.json()
      setAddress(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    }
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
      // Controllo duplicati in tempo reale via GPS
      setDupAlert(checkDuplicatiPos({ lat, lng }))
      setLoading(false)
    }, () => { showToast('Impossibile ottenere la posizione GPS', 'error'); setLoading(false) })
  }

  // Funzione riutilizzabile con pos esplicita (usata anche da map click e GPS in tempo reale)
  const checkDuplicatiPos = (pos) => {
    if (!pos) return null
    const toRad = deg => deg * Math.PI / 180
    const distanza = (s) => {
      const R = 6371000
      const dLat = toRad(s.lat - pos.lat)
      const dLng = toRad(s.lng - pos.lng)
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(pos.lat)) * Math.cos(toRad(s.lat)) * Math.sin(dLng/2)**2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    }
    return segnalazioni.find(s =>
      s.stato !== 'risolta' &&
      s.stato !== 'rifiutata' &&
      distanza(s) <= 50
    )
  }
  const checkDuplicati = (pos) => checkDuplicatiPos(pos)

  const analyzeWithAI = async () => {
    if (!foto) return { valid: true, result: { valida: true, messaggio: 'Nessuna foto — validazione manuale richiesta' } }
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
      const parsed = await resp.json()
      return { valid: parsed.valida && !parsed.contiene_persone, result: parsed }
    } catch {
      return { valid: true, result: { valida: true, messaggio: 'Analisi AI non disponibile' } }
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      // 1. Analisi AI
      const ai = await analyzeWithAI()
      setAiResult(ai)
      if (!ai.valid) {
        showToast('❌ Foto non valida: ' + (ai.result?.messaggio || ''), 'error')
        setLoading(false)
        return
      }

      // 2. Upload foto su Supabase Storage
      let foto_url = null
      if (foto) {
        foto_url = await uploadFoto(foto, session.user.id)
      }

      // 3. Salva segnalazione su Supabase
      const nuova = await insertSegnalazione({
        user_id: session.user.id,
        lat: position.lat,
        lng: position.lng,
        address,
        pericolosita,
        stato: 'segnalata',
        descrizione,
        foto_url,
        foto_validata: ai.valid,
        note_comune: '',
        segnalante_nome: profile?.nome || session.user.email,
      })

      onSubmit(nuova)
      showToast('✅ Segnalazione inviata con successo!', 'success')
      setStep(1); setFoto(null); setFotoUrl(null); setPosition(null)
      setAddress(''); setPericolosita(''); setDescrizione(''); setAiResult(null)
      setPage('mappa')
    } catch (e) {
      showToast('Errore nell\'invio: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const steps = ['Foto', 'Posizione', 'Pericolosità', 'Dettagli']

  return (
    <div style={{ minHeight: 'calc(100dvh - 54px)', background: '#0f172a', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '28px 16px 40px' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Segnala una buca</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>Aiuta il tuo comune a migliorare le strade</p>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: step > i+1 ? '#22c55e' : step === i+1 ? '#3b82f6' : '#1e293b', border: `2px solid ${step > i+1 ? '#22c55e' : step === i+1 ? '#3b82f6' : '#334155'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: step >= i+1 ? 'white' : '#64748b', fontWeight: 700, fontSize: 13, transition: 'all .3s' }}>
                  {step > i+1 ? '✓' : i+1}
                </div>
                <span style={{ color: step === i+1 ? '#3b82f6' : '#64748b', fontSize: 10, marginTop: 3, whiteSpace: 'nowrap' }}>{s}</span>
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: step > i+1 ? '#22c55e' : '#1e293b', margin: '0 6px', marginBottom: 16, transition: 'all .3s' }} />}
            </div>
          ))}
        </div>

        <Card className="fade-in">
          {/* Step 1 - Foto */}
          {step === 1 && (
            <div>
              <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 600, marginBottom: 5 }}>Carica una foto</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>Scatta o carica una foto della buca stradale</p>
              <label style={{ display: 'block', border: `2px dashed ${fotoUrl ? '#22c55e' : '#334155'}`, borderRadius: 12, cursor: 'pointer', overflow: 'hidden', padding: fotoUrl ? 0 : 40, textAlign: 'center' }}>
                <input type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{ display: 'none' }} />
                {fotoUrl
                  ? <div><img src={fotoUrl} alt="Preview" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} /><div style={{ padding: 10, color: '#22c55e', fontSize: 13, background: '#052e16' }}>✓ Foto caricata — tocca per cambiare</div></div>
                  : <div><div style={{ fontSize: 44, marginBottom: 10 }}>📷</div><div style={{ color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>Tocca per caricare</div><div style={{ color: '#64748b', fontSize: 12 }}>JPG, PNG, WebP</div></div>
                }
              </label>
            </div>
          )}

          {/* Step 2 - Posizione */}
          {step === 2 && (
            <div>
              <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 600, marginBottom: 14 }}>Seleziona la posizione</h2>
              <button onClick={handleGPS} className="btn-p" disabled={loading} style={{ marginBottom: 12 }}>
                {loading ? <><Spinner /> Rilevamento GPS...</> : '📡 Usa la mia posizione GPS'}
              </button>
              <div ref={mapRef2} style={{ height: 240, borderRadius: 10, marginBottom: 10, border: '1px solid #334155', overflow: 'hidden' }} />
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>Oppure tocca sulla mappa per selezionare</div>
              {address && <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', color: '#94a3b8', fontSize: 13 }}>📍 {address}</div>}
              {dupAlert && (
                <div style={{ background: '#451a03', border: '1px solid #f97316', borderRadius: 8, padding: '12px 14px', marginTop: 10 }}>
                  <div style={{ color: '#fb923c', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>⚠️ Possibile duplicato rilevato</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Esiste già una segnalazione entro 50m: "{dupAlert.address}" · {STATO_CONFIG[dupAlert.stato]?.label}</div>
                </div>
              )}
            </div>
          )}

          {/* Step 3 - Pericolosità */}
          {step === 3 && (
            <div>
              <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 600, marginBottom: 5 }}>Livello di pericolosità</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>Quanto è pericolosa questa buca?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { k: 'bassa', emoji: '🟢', desc: 'Piccola buca, disagio minimo' },
                  { k: 'media', emoji: '🟡', desc: 'Buca evidente, rischio su due ruote' },
                  { k: 'alta', emoji: '🟠', desc: 'Buca profonda, pericolo concreto' },
                  { k: 'critica', emoji: '🔴', desc: 'Buca grave, urgente intervento' },
                ].map(opt => (
                  <button key={opt.k} onClick={() => setPericolosita(opt.k)}
                    style={{ background: '#0f172a', border: `2px solid ${pericolosita === opt.k ? PERICOLOSITA_CONFIG[opt.k].color : '#334155'}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all .15s', fontFamily: 'inherit', textAlign: 'left' }}>
                    <span style={{ fontSize: 20 }}>{opt.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: PERICOLOSITA_CONFIG[opt.k].color, fontWeight: 700, fontSize: 14 }}>{PERICOLOSITA_CONFIG[opt.k].label}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{opt.desc}</div>
                    </div>
                    {pericolosita === opt.k && <span style={{ color: PERICOLOSITA_CONFIG[opt.k].color }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 - Dettagli */}
          {step === 4 && (
            <div>
              <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 600, marginBottom: 5 }}>Descrizione (opzionale)</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>Aggiungi dettagli utili per il comune</p>
              <textarea value={descrizione} onChange={e => setDescrizione(e.target.value)} placeholder="Es: buca vicino all'incrocio, pericolosa per le moto..." style={{ marginBottom: 14 }} />
              {aiResult && (
                <div style={{ background: aiResult.valid ? '#052e16' : '#450a0a', border: `1px solid ${aiResult.valid ? '#22c55e' : '#ef4444'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ color: aiResult.valid ? '#22c55e' : '#ef4444', fontWeight: 600, marginBottom: 3, fontSize: 13 }}>
                    {aiResult.valid ? '✅ Foto validata dall\'AI' : '❌ Foto non valida'}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 13 }}>{aiResult.result?.messaggio}</div>
                </div>
              )}
              <div style={{ background: '#0f172a', borderRadius: 10, padding: 14, marginBottom: 4 }}>
                <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>Riepilogo</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ color: '#64748b', fontSize: 13, flexShrink: 0 }}>Indirizzo:</span>
                    <span style={{ color: '#94a3b8', fontSize: 13, textAlign: 'right' }}>{address || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: 13 }}>Pericolosità:</span>
                    {pericolosita && <Badge cfg={PERICOLOSITA_CONFIG[pericolosita]}>{PERICOLOSITA_CONFIG[pericolosita].label}</Badge>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontSize: 13 }}>Foto:</span>
                    <span style={{ color: foto ? '#22c55e' : '#ef4444', fontSize: 13 }}>{foto ? '✓ Caricata' : '✗ Mancante'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
            {step > 1 && <button onClick={() => setStep(s => s - 1)} className="btn-g">← Indietro</button>}
            {step < 4 && (
              <button className="btn-p" onClick={() => {
                if (step === 1 && !foto) { showToast('Carica una foto prima di procedere', 'error'); return }
                if (step === 2 && !position) { showToast('Seleziona la posizione sulla mappa', 'error'); return }
                if (step === 3 && !pericolosita) { showToast('Seleziona il livello di pericolosità', 'error'); return }
                if (step === 2) { const dup = checkDuplicati(position); setDupAlert(dup || null) }
                setStep(s => s + 1)
              }}>Avanti →</button>
            )}
            {step === 4 && (
              <button className="btn-p" onClick={handleSubmit} disabled={loading}>
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
    (!search || s.address?.toLowerCase().includes(search.toLowerCase()) || s.descrizione?.toLowerCase().includes(search.toLowerCase()) || s.segnalante_nome?.toLowerCase().includes(search.toLowerCase()))
  )

  const agg = {
    totale: segnalazioni.length,
    critiche: segnalazioni.filter(s => s.pericolosita === 'critica').length,
    in_lavorazione: segnalazioni.filter(s => s.stato === 'in_lavorazione').length,
    risolte: segnalazioni.filter(s => s.stato === 'risolta').length,
    validate: segnalazioni.filter(s => s.foto_validata).length,
  }

  const openEdit = (s) => {
    setEditing(s)
    setEditData({ stato: s.stato, pericolosita: s.pericolosita, foto_validata: s.foto_validata, note_comune: s.note_comune || '' })
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const updated = await updateSegnalazione(editing.id, editData)
      onUpdate(editing.id, updated)
      showToast('✅ Segnalazione aggiornata', 'success')
      setEditing(null)
    } catch (e) {
      showToast('Errore nel salvataggio: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100dvh - 54px)', background: '#0f172a', padding: '24px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Dashboard Comune</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>Gestione e monitoraggio segnalazioni</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Totali', val: agg.totale, color: '#3b82f6', icon: '📋' },
            { label: 'Critiche', val: agg.critiche, color: '#ef4444', icon: '🔴' },
            { label: 'In lavorazione', val: agg.in_lavorazione, color: '#f59e0b', icon: '🔧' },
            { label: 'Risolte', val: agg.risolte, color: '#22c55e', icon: '✅' },
            { label: 'Validate AI', val: agg.validate, color: '#8b5cf6', icon: '🤖' },
          ].map(s => (
            <div key={s.label} style={{ background: '#1e293b', borderRadius: 12, padding: '14px 16px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ color: s.color, fontSize: 22, fontWeight: 700 }}>{s.val}</span>
              </div>
              <div style={{ color: '#64748b', fontSize: 12 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filtri */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cerca per indirizzo, descrizione, utente..." style={{ flex: 1, minWidth: 200 }} />
          <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)} style={{ width: 'auto' }}>
            <option value="tutti">Tutti gli stati</option>
            {Object.entries(STATO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filtroPerc} onChange={e => setFiltroPerc(e.target.value)} style={{ width: 'auto' }}>
            <option value="tutti">Tutti i livelli</option>
            {Object.entries(PERICOLOSITA_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <div style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>{filtered.length} segnalazioni trovate</div>

        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(s => (
            <div key={s.id} style={{ background: '#1e293b', borderRadius: 12, border: '1px solid #334155', padding: 14, display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 72, height: 58, borderRadius: 8, background: '#0f172a', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {s.foto_url ? <img src={s.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🕳️'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address}</div>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>
                  {new Date(s.created_at).toLocaleDateString('it-IT')} · {s.segnalante_nome || s.profiles?.nome || 'Utente'}
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <Badge cfg={PERICOLOSITA_CONFIG[s.pericolosita]}>⚠️ {PERICOLOSITA_CONFIG[s.pericolosita]?.label}</Badge>
                  <Badge cfg={STATO_CONFIG[s.stato]}>{STATO_CONFIG[s.stato]?.label}</Badge>
                  {s.foto_validata && <Badge cfg={{ bg: '#1e1b4b', text: '#818cf8' }}>🤖 AI</Badge>}
                </div>
              </div>
              <button onClick={() => openEdit(s)} className="btn-g" style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}>✏️</button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#64748b' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 14 }}>Nessuna segnalazione trovata</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal modifica */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setEditing(null)}>
          <div style={{ background: '#1e293b', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxWidth: 520, border: '1px solid #334155', maxHeight: '85dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: '#334155', borderRadius: 2, margin: '0 auto 18px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700 }}>Modifica segnalazione</h3>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20, padding: 4 }}>✕</button>
            </div>
            {editing.foto_url && <img src={editing.foto_url} alt="Buca" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 10, marginBottom: 14 }} />}
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 18, padding: '10px 14px', background: '#0f172a', borderRadius: 8 }}>📍 {editing.address}</div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Stato</label>
                <select value={editData.stato} onChange={e => setEditData(d => ({ ...d, stato: e.target.value }))}>
                  {Object.entries(STATO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Pericolosità</label>
                <select value={editData.pericolosita} onChange={e => setEditData(d => ({ ...d, pericolosita: e.target.value }))}>
                  {Object.entries(PERICOLOSITA_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="val" checked={editData.foto_validata} onChange={e => setEditData(d => ({ ...d, foto_validata: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#3b82f6' }} />
                <label htmlFor="val" style={{ color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>Foto validata manualmente</label>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Note ufficiali del comune</label>
                <textarea value={editData.note_comune} onChange={e => setEditData(d => ({ ...d, note_comune: e.target.value }))} placeholder="Inserisci note ufficiali..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setEditing(null)} className="btn-g">Annulla</button>
              <button onClick={saveEdit} className="btn-p" disabled={saving}>
                {saving ? <Spinner /> : '💾 Salva modifiche'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
