import { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon (problema noto con Vite/webpack)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const SAMPLE_DATA = [
  { id: 1, lat: 41.9028, lng: 12.4964, address: 'Via del Corso 45, Roma', pericolosita: 'critica', stato: 'segnalata', data: '2025-05-28', descrizione: 'Buca profonda 20cm, molto pericolosa per le moto', foto_validata: true, foto: null, note_comune: '', segnalante: 'Mario R.' },
  { id: 2, lat: 41.9058, lng: 12.4824, address: 'Viale Trastevere 12, Roma', pericolosita: 'alta', stato: 'in_lavorazione', data: '2025-05-25', descrizione: 'Crepa longitudinale nel manto stradale', foto_validata: true, foto: null, note_comune: 'Sopralluogo effettuato, lavori programmati', segnalante: 'Lucia B.' },
  { id: 3, lat: 41.8982, lng: 12.5100, address: 'Via Appia Nuova 230, Roma', pericolosita: 'media', stato: 'risolta', data: '2025-05-20', descrizione: 'Buca di medie dimensioni vicino marciapiede', foto_validata: true, foto: null, note_comune: 'Riparata il 27/05', segnalante: 'Giovanni F.' },
  { id: 4, lat: 41.9108, lng: 12.4764, address: 'Lungotevere Marzio 8, Roma', pericolosita: 'bassa', stato: 'segnalata', data: '2025-05-30', descrizione: 'Piccola buca ai margini della carreggiata', foto_validata: true, foto: null, note_comune: '', segnalante: 'Anna C.' },
  { id: 5, lat: 41.8948, lng: 12.4894, address: 'Via Ostiense 67, Roma', pericolosita: 'critica', stato: 'in_lavorazione', data: '2025-05-29', descrizione: 'Buca enorme con rischio caduta veicoli', foto_validata: true, foto: null, note_comune: 'Urgente - transennato', segnalante: 'Roberto M.' },
  { id: 6, lat: 41.9068, lng: 12.5044, address: 'Via Labicana 15, Roma', pericolosita: 'alta', stato: 'segnalata', data: '2025-05-31', descrizione: 'Dissesto del manto in corrispondenza del tombino', foto_validata: true, foto: null, note_comune: '', segnalante: 'Chiara V.' },
]

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

// ─── UTILITY ────────────────────────────────────────────────────────────────

function Badge({ cfg, children }) {
  return (
    <span style={{ background: cfg.bg, color: cfg.text, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {children}
    </span>
  )
}

function Toast({ toast }) {
  if (!toast) return null
  const colors = { success: ['#065f46', '#10b981'], error: ['#991b1b', '#ef4444'], info: ['#1e3a5f', '#3b82f6'] }
  const [bg, border] = colors[toast.type] || colors.info
  return (
    <div style={{ position: 'fixed', top: 70, right: 16, zIndex: 9999, background: bg, border: `1px solid ${border}`, color: 'white', padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 500, maxWidth: 340, animation: 'fadeIn .2s ease', lineHeight: 1.4 }}>
      {toast.msg}
    </div>
  )
}

// ─── ROOT APP ────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState('mappa')
  const [segnalazioni, setSegnalazioni] = useState(SAMPLE_DATA)
  const [role] = useState('admin')
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3800)
  }

  const addSegnalazione = (s) => setSegnalazioni(prev => [...prev, { ...s, id: Date.now() }])
  const updateSegnalazione = (id, updates) => setSegnalazioni(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", minHeight: '100dvh', background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#1e293b}::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        .fade-in{animation:fadeIn .2s ease}
        .btn-p{background:#3b82f6;color:#fff;border:none;padding:11px 20px;border-radius:9px;cursor:pointer;font-weight:600;font-size:14px;font-family:inherit;transition:all .15s;width:100%}
        .btn-p:hover{background:#2563eb}
        .btn-p:disabled{background:#334155;color:#64748b;cursor:default}
        .btn-g{background:transparent;color:#94a3b8;border:1px solid #334155;padding:10px 18px;border-radius:9px;cursor:pointer;font-weight:500;font-size:14px;font-family:inherit;transition:all .15s;width:100%}
        .btn-g:hover{background:#1e293b;color:#e2e8f0}
        input[type=text],input[type=number],textarea,select{background:#1e293b;border:1px solid #334155;color:#e2e8f0;padding:10px 14px;border-radius:8px;width:100%;font-size:14px;outline:none;transition:border .15s;font-family:inherit}
        input[type=text]:focus,input[type=number]:focus,textarea:focus,select:focus{border-color:#3b82f6}
        textarea{resize:vertical;min-height:80px}
        select option{background:#1e293b}
      `}</style>

      {/* NAV */}
      <nav style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, height: 54, position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
          <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg,#3b82f6,#06b6d4)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🕳️</div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Buche<span style={{ color: '#3b82f6' }}>Strade</span></span>
        </div>
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {[
            { id: 'mappa', label: '🗺️ Mappa' },
            { id: 'segnala', label: '📍 Segnala' },
            ...(role === 'admin' || role === 'supervisor' ? [{ id: 'dashboard', label: '⚙️ Admin' }] : [])
          ].map(tab => (
            <button key={tab.id} onClick={() => setPage(tab.id)}
              style={{ background: page === tab.id ? '#1e293b' : 'transparent', border: 'none', color: page === tab.id ? '#3b82f6' : '#64748b', padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: page === tab.id ? 600 : 400, fontSize: 13, fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <Toast toast={toast} />

      <div style={{ flex: 1 }}>
        {page === 'mappa' && <MappaPage segnalazioni={segnalazioni} />}
        {page === 'segnala' && <SegnalaPage segnalazioni={segnalazioni} onSubmit={addSegnalazione} showToast={showToast} setPage={setPage} />}
        {page === 'dashboard' && <DashboardPage segnalazioni={segnalazioni} onUpdate={updateSegnalazione} showToast={showToast} />}
      </div>
    </div>
  )
}

// ─── MAPPA ──────────────────────────────────────────────────────────────────

function MappaPage({ segnalazioni }) {
  const [filtroStato, setFiltroStato] = useState('tutti')
  const [filtroPerc, setFiltroPerc] = useState('tutti')
  const [selected, setSelected] = useState(null)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])

  const visible = segnalazioni.filter(s =>
    s.foto_validata &&
    s.stato !== 'rifiutata' &&
    (filtroStato === 'tutti' || s.stato === filtroStato) &&
    (filtroPerc === 'tutti' || s.pericolosita === filtroPerc)
  )

  const stats = {
    totale: segnalazioni.filter(s => s.foto_validata).length,
    critiche: segnalazioni.filter(s => s.pericolosita === 'critica' && s.foto_validata).length,
    alte: segnalazioni.filter(s => s.pericolosita === 'alta' && s.foto_validata).length,
    risolte: segnalazioni.filter(s => s.stato === 'risolta').length,
  }

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const map = L.map(mapRef.current).setView([41.9028, 12.4964], 13)
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
  }, [visible])

  return (
    <div style={{ height: 'calc(100dvh - 54px)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Stat bar */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
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

      <div ref={mapRef} style={{ flex: 1 }} />

      {/* Modal dettaglio */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,.6)' }} onClick={() => setSelected(null)}>
          <div style={{ background: '#1e293b', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxWidth: 520, border: '1px solid #334155', maxHeight: '70dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: '#334155', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{selected.address}</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>{selected.data}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20, padding: 4 }}>✕</button>
            </div>
            {selected.foto
              ? <img src={selected.foto} alt="Buca" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 10, marginBottom: 14 }} />
              : <div style={{ width: '100%', height: 100, background: '#0f172a', borderRadius: 10, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🕳️</div>
            }
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <Badge cfg={PERICOLOSITA_CONFIG[selected.pericolosita]}>⚠️ {PERICOLOSITA_CONFIG[selected.pericolosita].label}</Badge>
              <Badge cfg={STATO_CONFIG[selected.stato]}>{STATO_CONFIG[selected.stato].label}</Badge>
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

// ─── SEGNALA ────────────────────────────────────────────────────────────────

function SegnalaPage({ segnalazioni, onSubmit, showToast, setPage }) {
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
      setLoading(false)
    }, () => { showToast('Impossibile ottenere la posizione GPS', 'error'); setLoading(false) })
  }

  const checkDuplicati = (pos) => {
    if (!pos) return null
    const R = 0.00045
    return segnalazioni.find(s => Math.abs(s.lat - pos.lat) < R && Math.abs(s.lng - pos.lng) < R)
  }

  // Chiama la nostra serverless function /api/analyze-photo (chiave sicura sul server)
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
      return { valid: true, result: { valida: true, messaggio: 'Analisi AI non disponibile — validazione manuale' } }
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    const ai = await analyzeWithAI()
    setAiResult(ai)
    setLoading(false)
    if (!ai.valid) {
      showToast('❌ Foto non valida: ' + (ai.result?.messaggio || ''), 'error')
      return
    }
    onSubmit({
      lat: position.lat, lng: position.lng, address, pericolosita,
      stato: 'segnalata', data: new Date().toISOString().split('T')[0],
      descrizione, foto_validata: ai.valid, foto: fotoUrl,
      note_comune: '', segnalante: 'Utente'
    })
    showToast('✅ Segnalazione inviata con successo!', 'success')
    setStep(1); setFoto(null); setFotoUrl(null); setPosition(null)
    setAddress(''); setPericolosita(''); setDescrizione(''); setAiResult(null)
    setPage('mappa')
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

        <div style={{ background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155' }} className="fade-in">

          {/* Step 1 */}
          {step === 1 && (
            <div>
              <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 600, marginBottom: 5 }}>Carica una foto</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>Scatta o carica una foto della buca stradale</p>
              <label style={{ display: 'block', border: `2px dashed ${fotoUrl ? '#22c55e' : '#334155'}`, borderRadius: 12, padding: fotoUrl ? 0 : 40, textAlign: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                <input type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{ display: 'none' }} />
                {fotoUrl
                  ? <div><img src={fotoUrl} alt="Preview" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} /><div style={{ padding: '10px', color: '#22c55e', fontSize: 13, background: '#052e16' }}>✓ Foto caricata — tocca per cambiare</div></div>
                  : <div><div style={{ fontSize: 44, marginBottom: 10 }}>📷</div><div style={{ color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>Tocca per caricare</div><div style={{ color: '#64748b', fontSize: 12 }}>JPG, PNG, WebP</div></div>
                }
              </label>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 600, marginBottom: 14 }}>Seleziona la posizione</h2>
              <button onClick={handleGPS} className="btn-p" disabled={loading} style={{ marginBottom: 12 }}>
                {loading ? '📡 Rilevamento GPS...' : '📡 Usa la mia posizione GPS'}
              </button>
              <div ref={mapRef2} style={{ height: 240, borderRadius: 10, marginBottom: 10, border: '1px solid #334155', overflow: 'hidden' }} />
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>Oppure tocca sulla mappa per selezionare</div>
              {address && <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', color: '#94a3b8', fontSize: 13 }}>📍 {address}</div>}
              {dupAlert && (
                <div style={{ background: '#451a03', border: '1px solid #f97316', borderRadius: 8, padding: '12px 14px', marginTop: 10 }}>
                  <div style={{ color: '#fb923c', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>⚠️ Possibile duplicato rilevato</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Esiste già una segnalazione entro 50m: "{dupAlert.address}" · {STATO_CONFIG[dupAlert.stato].label}</div>
                </div>
              )}
            </div>
          )}

          {/* Step 3 */}
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
                  <button key={opt.k} onClick={() => setPericolosita(opt.k)} style={{ background: '#0f172a', border: `2px solid ${pericolosita === opt.k ? PERICOLOSITA_CONFIG[opt.k].color : '#334155'}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all .15s', fontFamily: 'inherit', textAlign: 'left' }}>
                    <span style={{ fontSize: 20 }}>{opt.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: PERICOLOSITA_CONFIG[opt.k].color, fontWeight: 700, fontSize: 14 }}>{PERICOLOSITA_CONFIG[opt.k].label}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{opt.desc}</div>
                    </div>
                    {pericolosita === opt.k && <span style={{ color: PERICOLOSITA_CONFIG[opt.k].color, fontSize: 16 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div>
              <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 600, marginBottom: 5 }}>Descrizione (opzionale)</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>Aggiungi dettagli utili per il comune</p>
              <textarea value={descrizione} onChange={e => setDescrizione(e.target.value)} placeholder="Es: buca vicino all'incrocio, molto pericolosa per le moto..." style={{ marginBottom: 14 }} />
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

          {/* Bottoni nav */}
          <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
            {step > 1 && <button onClick={() => setStep(s => s - 1)} className="btn-g">← Indietro</button>}
            {step < 4 && (
              <button className="btn-p" onClick={() => {
                if (step === 1 && !foto) { showToast('Carica una foto prima di procedere', 'error'); return }
                if (step === 2 && !position) { showToast('Seleziona la posizione sulla mappa', 'error'); return }
                if (step === 3 && !pericolosita) { showToast('Seleziona il livello di pericolosità', 'error'); return }
                if (step === 2) {
                  const dup = checkDuplicati(position)
                  setDupAlert(dup || null)
                }
                setStep(s => s + 1)
              }}>Avanti →</button>
            )}
            {step === 4 && (
              <button className="btn-p" onClick={handleSubmit} disabled={loading}>
                {loading ? '🤖 Analisi AI in corso...' : '📤 Invia segnalazione'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────

function DashboardPage({ segnalazioni, onUpdate, showToast }) {
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState('tutti')
  const [filtroPerc, setFiltroPerc] = useState('tutti')
  const [editing, setEditing] = useState(null)
  const [editData, setEditData] = useState({})

  const filtered = segnalazioni.filter(s =>
    (filtroStato === 'tutti' || s.stato === filtroStato) &&
    (filtroPerc === 'tutti' || s.pericolosita === filtroPerc) &&
    (!search || s.address.toLowerCase().includes(search.toLowerCase()) || s.descrizione?.toLowerCase().includes(search.toLowerCase()))
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

  const saveEdit = () => {
    onUpdate(editing.id, editData)
    showToast('✅ Segnalazione aggiornata', 'success')
    setEditing(null)
  }

  return (
    <div style={{ minHeight: 'calc(100dvh - 54px)', background: '#0f172a', padding: '24px 16px' }}>
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
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cerca..." style={{ flex: 1, minWidth: 180 }} />
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
              {s.foto ? <img src={s.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🕳️'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address}</div>
              <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>{s.data} · {s.segnalante}</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <Badge cfg={PERICOLOSITA_CONFIG[s.pericolosita]}>⚠️ {PERICOLOSITA_CONFIG[s.pericolosita].label}</Badge>
                <Badge cfg={STATO_CONFIG[s.stato]}>{STATO_CONFIG[s.stato].label}</Badge>
              </div>
            </div>
            <button onClick={() => openEdit(s)} className="btn-g" style={{ width: 'auto', padding: '8px 12px', fontSize: 13, whiteSpace: 'nowrap' }}>✏️</button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 0', color: '#64748b' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: 14 }}>Nessuna segnalazione trovata</div>
          </div>
        )}
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
              <button onClick={saveEdit} className="btn-p">💾 Salva modifiche</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
