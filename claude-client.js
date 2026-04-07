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
                text: 'Analyse cette facture energie. Reponds UNIQUEMENT en JSON sans markdown: {"fournisseur":"","pdl":"","periode":"","date_fin_contrat":"","montant_ht":0,"montant_ttc":0,"consommation_kwh":0,"prix_kwh":0,"puissance_kva":0,"cout_abonnement":0,"cout_energie":0,"cout_taxes":0,"emissions_co2":0,"anomalies"::":[]}'
              }]
            }]
          }
        })
      });
      var data = await response.json();
      console.log('Claude response:', data);
      if (data.content && data.content[0]) {
        var text = data.content[0].text;
        console.log('Claude text:', text);
        var clean = text.replace(/```json|```/g,'').trim();
        var result = JSON.parse(clean);
        if (currentClientId && SEF_CLIENTS[currentClientId]) {
          var c = SEF_CLIENTS[currentClientId];
          if (currentClientId && SEF_CLIENTS[currentClientId]) {
  var c = SEF_CLIENTS[currentClientId];
  if (result.montant_ttc) c.facture = result.montant_ttc.toLocaleString('fr-FR') + ' €';
  if (result.consommation_kwh) c.conso = result.consommation_kwh.toLocaleString('fr-FR') + ' kWh';
  if (result.prix_kwh) c.prix_kwh = result.prix_kwh;
  if (result.fournisseur) c.fournisseur = result.fournisseur;
  if (result.pdl) c.pdl = result.pdl;
  if (result.puissance_kva) c.puissance = result.puissance_kva;
  if (result.emissions_co2) c.carbon = result.emissions_co2 + ' kg CO₂';
  if (result.cout_abonnement) c.cout_abo = result.cout_abonnement;
  if (result.date_fin_contrat) c.date_fin = result.date_fin_contrat;
  if (result.anomalies) c.anomalies = result.anomalies;
  saveClients();
  var $t = function(id,v){var el=document.getElementById(id);if(el&&v)el.textContent=v;};
  $t('d-facture', c.facture);
  $t('d-conso', c.conso);
  $t('d-carbon', c.carbon);
  $t('d-fournisseur', c.fournisseur);
}
          var el1 = document.getElementById('d-facture');
          var el2 = document.getElementById('d-conso');
          if (el1) el1.textContent = c.facture;
          if (el2) el2.textContent = c.conso;
        }
        var zone = document.getElementById('upload-result');
        if (zone) {
          zone.style.display = 'block';
          zone.innerHTML = '<div style="padding:16px;background:rgba(163,230,53,0.06);border:1px solid rgba(163,230,53,0.2);border-radius:8px"><div style="font-size:12px;font-weight:600;color:var(--volt);margin-bottom:8px">✅ Analyse Claude terminée</div><div style="font-size:12px;color:var(--text1);line-height:1.8">📋 Fournisseur : <strong>' + (result.fournisseur||'—') + '</strong><br>📅 Période : <strong>' + (result.periode||'—') + '</strong><br>💶 Montant TTC : <strong>' + (result.montant_ttc||'—') + ' €</strong><br>⚡ Consommation : <strong>' + (result.consommation_kwh||'—') + ' kWh</strong><br>💰 Prix/kWh : <strong>' + (result.prix_kwh||'—') + ' €</strong><br>' + (result.anomalies && result.anomalies.length ? '⚠️ Anomalies : <strong>' + result.anomalies.join(', ') + '</strong>' : '✅ Aucune anomalie') + '</div></div>';
        }
        showToast('✅ Facture analysée !');
      }
    } catch(e) {
      console.log('Erreur:', e);
      showToast('⚠ Erreur : ' + e.message);
    }
  };
  reader.readAsDataURL(file);
}