export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Access-Control-Allow-Origin', '*')

  const { imageBase64, mediaType } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 richiesto' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Chiave API non configurata' })

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
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: 'Analizza questa immagine. Rispondi SOLO con JSON valido (senza backtick): {"valida": true/false, "contiene_persone": true/false, "mostra_buca": true/false, "messaggio": "breve spiegazione in italiano"}. Una buca stradale è un avvallamento, crepa o dissesto del manto stradale. La foto è valida se mostra una buca reale E non contiene persone identificabili.' }
          ]
        }]
      })
    })
    const data = await response.json()
    const text = data.content?.find(c => c.type === 'text')?.text || '{}'
    try {
      return res.status(200).json(JSON.parse(text.replace(/```json|```/g, '').trim()))
    } catch {
      return res.status(200).json({ valida: true, contiene_persone: false, mostra_buca: true, messaggio: 'Analisi AI non disponibile — validazione manuale' })
    }
  } catch (e) {
    return res.status(500).json({ error: 'Errore server', detail: e.message })
  }
}
