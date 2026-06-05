export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Access-Control-Allow-Origin', '*')

  const { imageBase64, mediaType } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 richiesto' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Chiave API non configurata sul server' })

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
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 }
            },
            {
              type: 'text',
              text: `Sei un validatore di foto per un'app di segnalazione buche stradali del comune.
Analizza RIGOROSAMENTE questa immagine e rispondi SOLO con JSON valido (senza backtick o markdown).

Criteri di validazione OBBLIGATORI (tutti devono essere soddisfatti):
1. La foto deve mostrare ESCLUSIVAMENTE una buca o un danno al manto stradale (avvallamento, crepa profonda, dissesto, voragine, buca su asfalto o pavé).
2. La foto NON deve contenere persone, volti o parti del corpo identificabili.
3. La foto deve essere chiaramente scattata in strada o su un marciapiede.
4. La foto NON deve mostrare altro (animali, interni, paesaggi, veicoli senza strada, selfie, cibo, ecc.).

Rispondi SOLO con questo JSON:
{
  "valida": true o false,
  "mostra_buca": true o false,
  "contiene_persone": true o false,
  "e_una_strada": true o false,
  "messaggio": "spiegazione breve in italiano del motivo della decisione"
}

Sii SEVERO: se hai anche solo un dubbio che non si tratti di una buca stradale reale, imposta valida: false.`
            }
          ]
        }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      // Errore API → blocca sempre, non passare
      return res.status(200).json({
        valida: false,
        mostra_buca: false,
        contiene_persone: false,
        e_una_strada: false,
        messaggio: 'Validazione AI non riuscita. Riprova tra qualche momento.'
      })
    }

    const data = await response.json()
    const text = data.content?.find(c => c.type === 'text')?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()

    try {
      const parsed = JSON.parse(clean)
      // Validazione solo se TUTTI i criteri sono soddisfatti
      parsed.valida = parsed.mostra_buca === true &&
                      parsed.contiene_persone === false &&
                      parsed.e_una_strada === true
      return res.status(200).json(parsed)
    } catch {
      // JSON non parsabile → blocca sempre
      return res.status(200).json({
        valida: false,
        mostra_buca: false,
        contiene_persone: false,
        e_una_strada: false,
        messaggio: 'Risposta AI non leggibile. Riprova con una foto più chiara.'
      })
    }
  } catch (error) {
    console.error('Server error:', error)
    // Qualsiasi errore server → blocca sempre
    return res.status(200).json({
      valida: false,
      mostra_buca: false,
      contiene_persone: false,
      e_una_strada: false,
      messaggio: 'Errore del server durante la validazione. Riprova tra qualche momento.'
    })
  }
}
