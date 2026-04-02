async function analyserFacture(texte) {
  try {
    showToast('🤖 Analyse IA en cours...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Analyse cette facture d'énergie et extrais en JSON : fournisseur, période, montant_ht, montant_ttc, consommation_kwh, prix_kwh, puissance_kva, anomalies détectées.\n\nFacture:\n${texte}`
        }]
      })
    });
    const data = await response.json();
    if (data.content && data.content[0]) {
      const result = data.content[0].text;
      showToast('✅ Analyse terminée !');
      var zone = document.getElementById('upload-result');
      if (zone) {
        zone.style.display = 'block';
        zone.innerHTML = '<div style="padding:16px;background:rgba(163,230,53,0.06);border:1px solid rgba(163,230,53,0.2);border-radius:8px">'
          + '<div style="font-size:12px;font-weight:600;color:var(--volt);margin-bottom:8px">🤖 Analyse IA — Résultats</div>'
          + '<pre style="font-size:11px;color:var(--text1);white-space:pre-wrap;line-height:1.6">' + result + '</pre>'
          + '</div>';
      }
    }
  } catch(e) {
    console.log('Erreur Claude:', e);
    showToast('⚠ Erreur analyse IA');
  }
}