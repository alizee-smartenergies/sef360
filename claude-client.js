async function handleDocumentUpload(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  showToast('🤖 Analyse Claude en cours...');

  var reader = new FileReader();
  reader.onload = async function(e) {
    var base64 = e.target.result.split(',')[1];
    var mediaType = file.type || 'application/pdf';
    try {
      var response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [{
              type: 'document',
              source: { type: 'base64', media_type: mediaType, data: base64 }
            }, {
              type: 'text',
              text: 'Analyse cette facture énergie. Réponds UNIQUEMENT en JSON avec ces champs: {"fournisseur":"","periode":"","montant_ttc":0,"consommation_kwh":0,"prix_kwh":0,"puissance_kva":0,"anomalies":[]}'
            }]
          }]
        })
      });
      var data = await response.json();
      if (data.content && data.content[0]) {
        var text = data.content[0].text;
        var clean = text.replace(/```json|```/g,'').trim();
        var result = JSON.parse(clean);
        
        // Mettre à jour les KPIs du client actif
        if (currentClientId && SEF_CLIENTS[currentClientId]) {
          var c = SEF_CLIENTS[currentClientId];
          c.facture = result.montant_ttc ? result.montant_ttc.toLocaleString('fr-FR') + ' €' : c.facture;
          c.conso = result.consommation_kwh ? result.consommation_kwh.toLocaleString('fr-FR') + ' kWh' : c.conso;
          c.kpi_facture = result.montant_ttc || '';
          c.kpi_conso = result.consommation_kwh ? result.consommation_kwh + ' kWh' : '';
          c.kpi_prix = result.prix_kwh || '';
          saveClients();
          renderKpisDisplay();
          var $t = function(id,v){var el=document.getElementById(id);if(el)el.textContent=v;};
          $t('d-facture', c.facture);
          $t('d-conso', c.conso);
        }

        // Afficher le résultat
        var zone = document.getElementById('upload-result');
        if (zone) {
          zone.style.display = 'block';
          zone.innerHTML = '<div style="padding:16px;background:rgba(163,230,53,0.06);border:1px solid rgba(163,230,53,0.2);border-radius:8px">'
            + '<div style="font-size:12px;font-weight:600;color:var(--volt);margin-bottom:8px">✅ Analyse Claude terminée</div>'
            + '<div style="font-size:12px;color:var(--text1);line-height:1.8">'
            + '📋 Fournisseur : <strong>' + (result.fournisseur||'—') + '</strong><br>'
            + '📅 Période : <strong>' + (result.periode||'—') + '</strong><br>'
            + '💶 Montant TTC : <strong>' + (result.montant_ttc||'—') + ' €</strong><br>'
            + '⚡ Consommation : <strong>' + (result.consommation_kwh||'—') + ' kWh</strong><br>'
            + '💰 Prix/kWh : <strong>' + (result.prix_kwh||'—') + ' €</strong><br>'
            + (result.anomalies && result.anomalies.length ? '⚠️ Anomalies : <strong>' + result.anomalies.join(', ') + '</strong>' : '✅ Aucune anomalie détectée')
            + '</div></div>';
        }
        showToast('✅ Facture analysée par Claude !');
      }
    } catch(e) {
      console.log('Erreur Claude:', e);
      showToast('⚠ Erreur analyse — ' + e.message);
    }
  };
  reader.readAsDataURL(file);
}