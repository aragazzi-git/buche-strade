// api/analyze-photo.js
// Serverless function Vercel — fa da proxy sicuro verso l'API Anthropic
// La chiave API rimane segreta nel server, mai esposta al browser

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // CORS headers per consentire le chiamate dal frontend
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  const { imageBase64, mediaType } = req.body

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 è richiesto' })
  }

  // La chiave viene letta dalla variabile d'ambiente di Vercel (mai hardcoded)
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Chiave API non configurata sul server' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: 'Analizza questa immagine. Rispondi SOLO con JSON valido (senza backtick o markdown): {"valida": true/false, "contiene_persone": true/false, "mostra_buca": true/false, "messaggio": "breve spiegazione in italiano"}. Una buca stradale è un avvallamento, crepa, buca nel manto stradale o dissesto del fondo stradale. La foto è valida se mostra una buca reale E non contiene persone identificabili.'
            }
          ]
        }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return res.status(502).json({ error: 'Errore API Anthropic', detail: err })
    }

    const data = await response.json()
    const text = data.content?.find(c => c.type === 'text')?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()

    try {
      const parsed = JSON.parse(clean)
      return res.status(200).json(parsed)
    } catch {
      // Se il JSON non è parsabile, restituiamo una risposta di fallback
      return res.status(200).json({
        valida: true,
        contiene_persone: false,
        mostra_buca: true,
        messaggio: 'Analisi AI non disponibile — richiesta validazione manuale'
      })
    }
  } catch (error) {
    console.error('Server error:', error)
    return res.status(500).json({ error: 'Errore interno del server' })
  }
}
