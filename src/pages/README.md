# 🕳️ BucheStrade v2 — Guida completa al deploy

App PWA per la segnalazione e gestione buche stradali con autenticazione, database e storage.

---

## Stack
- **Frontend**: React + Vite + PWA
- **Database + Auth + Storage**: Supabase (gratuito)
- **AI foto validation**: Anthropic Claude Vision
- **Deploy**: Vercel

---

## PASSO 1 — Configura Supabase

### 1a. Crea il progetto
1. Vai su [supabase.com](https://supabase.com) → "New project"
2. Dai un nome (es. `buche-strade`), scegli una password e la regione **West EU**
3. Aspetta ~2 minuti che si avvii

### 1b. Crea le tabelle e le policy
1. Nel menu a sinistra clicca **SQL Editor**
2. Clicca **New query**
3. Copia e incolla tutto il contenuto di `supabase-schema.sql`
4. Clicca **Run** (o Ctrl+Enter)
5. Dovresti vedere "Success. No rows returned"

### 1c. Abilita il login con Google (opzionale)
1. Menu → **Authentication → Providers**
2. Clicca **Google** → abilita il toggle
3. Segui le istruzioni per creare le credenziali OAuth su Google Cloud Console
4. Inserisci Client ID e Client Secret → Save

### 1d. Copia le credenziali Supabase
1. Menu → **Project Settings → API**
2. Copia:
   - **Project URL** → `https://xxxx.supabase.co`
   - **anon public key** → `eyJxxx...`

---

## PASSO 2 — Configura GitHub e Vercel

### 2a. Carica su GitHub
1. Crea repo su [github.com](https://github.com) → "New repository" → `buche-strade`
2. Carica tutti i file dello ZIP mantenendo la struttura delle cartelle

### 2b. Deploy su Vercel
1. [vercel.com](https://vercel.com) → "Add New Project" → importa da GitHub
2. Framework: **Vite** (rilevato automaticamente)
3. Prima di cliccare Deploy, vai su **Environment Variables** e aggiungi:

| Nome variabile | Valore |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJxxx...` |
| `ANTHROPIC_API_KEY` | `sk-ant-xxx...` |

4. Clicca **Deploy**

---

## PASSO 3 — Diventa Admin

1. Apri l'app sul tuo link Vercel
2. Registrati con la tua email
3. Torna su Supabase → **SQL Editor** → esegui:

```sql
update public.profiles set role = 'admin' where email = 'TUA@EMAIL.COM';
```

4. Ricarica l'app → vedrai la tab "⚙️ Admin"

### Aggiungere altri admin o supervisor
```sql
-- Admin (accesso completo)
update public.profiles set role = 'admin' where email = 'collega@comune.it';

-- Supervisor (può gestire segnalazioni, non eliminare)
update public.profiles set role = 'supervisor' where email = 'supervisore@comune.it';
```

---

## PASSO 4 — Installa sul telefono come PWA

**iPhone (Safari):**
1. Apri il link Vercel su Safari
2. Tocca l'icona **Condividi** (quadrato con freccia in basso)
3. Scorri → **"Aggiungi a schermata Home"** → Aggiungi

**Android (Chrome):**
1. Apri il link su Chrome
2. Tocca i **tre puntini** → **"Installa app"** o **"Aggiungi a schermata Home"**

---

## Sviluppo locale

```bash
npm install
cp .env.example .env.local
# Modifica .env.local con le tue credenziali
npm run dev
```

---

## Struttura progetto

```
buche-strade/
├── api/
│   └── analyze-photo.js      ← Proxy sicuro API Anthropic
├── src/
│   ├── lib/
│   │   └── supabase.js       ← Client Supabase + helpers
│   ├── App.jsx               ← App completa (Auth, Mappa, Segnala, Dashboard)
│   └── main.jsx              ← Entry point
├── supabase-schema.sql       ← Schema DB da eseguire su Supabase
├── index.html
├── vite.config.js
├── vercel.json
├── package.json
└── .env.example
```

---

## Ruoli utente

| Ruolo | Cosa può fare |
|---|---|
| `user` | Registrarsi, segnalare buche, vedere mappa con buche validate |
| `supervisor` | Tutto sopra + gestire tutte le segnalazioni dalla dashboard |
| `admin` | Tutto sopra + eliminare segnalazioni + promuovere utenti |

I ruoli si assegnano **solo via SQL** — nessun utente può auto-promuoversi.
