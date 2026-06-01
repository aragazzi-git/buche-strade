# 🕳️ BucheStrade — Guida al Deploy su Vercel

App PWA per la segnalazione e gestione delle buche stradali.

---

## 🚀 Deploy su Vercel (passo per passo)

### 1. Crea account GitHub (se non l'hai)
Vai su [github.com](https://github.com) → Sign up

### 2. Crea un nuovo repository GitHub
1. Clicca **"New repository"**
2. Nome: `buche-strade`
3. Visibilità: **Private** (consigliato)
4. Clicca **Create repository**

### 3. Carica i file su GitHub
Hai due opzioni:

**Opzione A — Upload manuale (più semplice):**
1. Nella pagina del repo, clicca **"uploading an existing file"**
2. Trascina TUTTI i file del progetto (mantieni la struttura delle cartelle)
3. Clicca **"Commit changes"**

**Opzione B — Con Git da terminale:**
```bash
cd buche-strade
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/TUO_USERNAME/buche-strade.git
git push -u origin main
```

### 4. Deploy su Vercel
1. Vai su [vercel.com](https://vercel.com) → Sign up con GitHub
2. Clicca **"Add New Project"**
3. Seleziona il repository `buche-strade`
4. Framework: **Vite** (dovrebbe rilevarlo automaticamente)
5. Clicca **Deploy**

### 5. Aggiungi la chiave API Anthropic (IMPORTANTE)
Senza questo passo la validazione AI non funziona.

1. Nel progetto Vercel, vai su **Settings → Environment Variables**
2. Aggiungi:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-...` (la tua chiave da [console.anthropic.com](https://console.anthropic.com))
3. Clicca **Save**
4. Vai su **Deployments** → clicca i tre puntini sull'ultimo deploy → **Redeploy**

### 6. Installa l'app sullo smartphone

**iPhone (Safari):**
1. Apri il link Vercel su Safari
2. Tocca l'icona **Condividi** (quadrato con freccia)
3. Scorri e tocca **"Aggiungi a schermata Home"**
4. Dai un nome → **Aggiungi**

**Android (Chrome):**
1. Apri il link su Chrome
2. Tocca i **tre puntini** in alto a destra
3. Tocca **"Aggiungi a schermata Home"** o **"Installa app"**

---

## 💻 Sviluppo locale

```bash
# Installa dipendenze
npm install

# Crea il file delle variabili d'ambiente
cp .env.example .env.local
# Modifica .env.local e inserisci la tua chiave API

# Avvia in sviluppo
npm run dev

# Build di produzione
npm run build
```

---

## 📁 Struttura del progetto

```
buche-strade/
├── api/
│   └── analyze-photo.js    ← Serverless function (proxy sicuro API Anthropic)
├── src/
│   ├── main.jsx            ← Entry point React
│   └── App.jsx             ← Tutta l'app (Mappa, Segnala, Dashboard)
├── index.html
├── vite.config.js          ← Config Vite + PWA
├── vercel.json             ← Routing Vercel
├── package.json
└── .env.example
```

---

## 🔒 Sicurezza

- La chiave API Anthropic è gestita **solo dal server** (`/api/analyze-photo.js`)
- Il browser non vede mai la chiave
- Le variabili d'ambiente su Vercel sono crittografate

---

## 🗄️ Note sul database

Attualmente i dati sono in memoria (si azzerano al refresh).
Per produzione reale, integra un database come:
- **Supabase** (PostgreSQL gratuito, con SDK React)
- **PlanetScale** (MySQL serverless)
- **Firebase Firestore** (NoSQL Google)
