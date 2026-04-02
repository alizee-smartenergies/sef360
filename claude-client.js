async function handleDocumentUpload(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  showToast('🤖 Analyse Claude en cours...');
  var reader = new FileReader();
  reader.onload = async function(e) {
    var base64 = e.target.result.split(',')[1];
    var mediaType = file.type || 'application/pdf';
    try {
      var response = await fetch('https://sef360-proxy.alizee-5b2.workers.dev/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: CLAUDE_API_KEY,
          payload: {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{
              role: 'user',
              content: [{
                type: 'document',
                source: { type: 'base64', media_type: mediaType, data: base64 }
              }, {
                type: 'text',
                text: 'Analyse cette facture energie. Reponds UNIQUEMENT en JSON: {"fournisseur":"","periode":"","montant_ttc":0,"consommation_kwh":0,"prix_kwh":0,"anomalies":[]}'
              }]
            }]
          }
        })
      });
      var data = await response.json();
      if (data.content && data.content[0]) {
        var text = data.content[0].text;
        var clean = text.replace(/```json|```/g,'').trim();
        var result = JSON.parse(clean);
        if (currentClientId && SEF_CLIENTS[currentClientId]) {
          var c = SEF_CLIENTS[currentClientId];
          if (result.montant_ttc) { c.facture = result.montant_ttc.toLocaleString('fr-FR') + ' €'; c.kpi_facture = result.montant_ttc; }
          if (result.consommation_kwh) { c.conso = result.consommation_kwh.toLocaleString('fr-FR') + ' kWh'; c.kpi_conso = result.consommation_kwh + ' kWh'; }
          if (result.prix_kwh) { c.kpi_prix = result.prix_kwh; }
          saveClients();
          renderKpisDisplay();
          var $t = function(id,v){var el=document.getElementById(id);if(el)el.textContent=v;};
          $t('d-facture', c.facture);
          $t('d-conso', c.conso);
        }
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
            + (result.anomalies && result.anomalies.length ? '⚠️ Anomalies : <strong>' + result.anomalies.join(', ') + '</strong>' : '✅ Aucune anomalie')
            + '</div></div>';
        }
        showToast('✅ Facture analysée !');
      }
    } catch(e) {
      console.log('Erreur Claude:', e);
      showToast('⚠ Erreur : ' + e.message);
    }
  };
  reader.readAsDataURL(file);
}