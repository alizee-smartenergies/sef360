async function handleDocumentUpload(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  var fileName = file.name;
  var fileDate = new Date().toLocaleDateString("fr-FR");
  showToast("🤖 Analyse Claude en cours...");
  var reader = new FileReader();
  reader.onload = async function(e) {
    var base64 = e.target.result.split(",")[1];
    var mediaType = file.type || "application/pdf";
    try {
      var response = await fetch("https://sef360-proxy.alizee-5b2.workers.dev/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            messages: [{ role: "user", content: [
              { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: "Analyse ce document energie. Fournisseur = vendeur commercial pas ENEDIS. JSON une ligne: {\"type_document\":\"facture\",\"fournisseur\":\"\",\"pdl\":\"\",\"periode\":\"\",\"date_fin_contrat\":\"\",\"montant_ttc\":0,\"consommation_kwh\":0,\"prix_kwh\":0,\"puissance_kva\":0,\"formule_tarifaire\":\"\",\"anomalies\":[]}" }
            ]}]
          }
        })
      });
      var data = await response.json();
      if (data.content && data.content[0]) {
        var text = data.content[0].text;
        console.log("Claude text:", text);
        var clean = text.replace(/```json|```/g,"").replace(/\n/g," ").trim();
        var result = JSON.parse(clean);
        var isContrat = result.type_document && result.type_document.includes("contrat");
        if (currentClientId && SEF_CLIENTS[currentClientId]) {
          var c = SEF_CLIENTS[currentClientId];
          if (!isContrat && result.montant_ttc) c.facture = result.montant_ttc.toLocaleString("fr-FR") + " €";
          if (!isContrat && result.consommation_kwh) c.conso = result.consommation_kwh.toLocaleString("fr-FR") + " kWh";
          if (result.prix_kwh) c.prix_kwh = result.prix_kwh;
          if (result.fournisseur) c.fournisseur = result.fournisseur;
          if (result.pdl) c.pdl = result.pdl;
          if (result.puissance_kva) c.puissance = result.puissance_kva;
          if (result.date_fin_contrat) c.date_fin = result.date_fin_contrat;
          if (!c.historique) c.historique = [];
          c.historique.unshift({ nom: fileName, date: fileDate, type: result.type_document || "facture", fournisseur: result.fournisseur || "—", periode: result.periode || "—", montant: result.montant_ttc || 0, kwh: result.consommation_kwh || 0, prix_kwh: result.prix_kwh || 0, anomalies: result.anomalies ? result.anomalies.length : 0, statut: result.anomalies && result.anomalies.length > 0 ? "Anomalie" : "Validé" });
          saveClients();
          var t = function(id,v){var el=document.getElementById(id);if(el&&v)el.textContent=v;};
          if (!isContrat) { t("kpi-facture-display",c.facture); t("kpi-conso-display",c.conso); t("d-facture",c.facture); t("d-conso",c.conso); }
          t("kpi-prix-display", result.prix_kwh ? result.prix_kwh.toFixed(4)+" €/kWh" : "");
          var tbody = document.getElementById("factures-tbody");
          if (tbody && c.historique) {
            tbody.innerHTML = c.historique.map(function(h) {
              var badge = h.type === "contrat" ? "📋" : "📄";
              var col = h.statut === "Validé" ? "#4ade80" : "#f87171";
              return "<tr style=\"border-bottom:1px solid rgba(255,255,255,0.05)\"><td style=\"padding:8px;font-size:11px\">" + badge + " " + h.nom + "<br><span style=\"color:var(--text2);font-size:10px\">" + h.date + "</span></td><td style=\"padding:8px;font-size:11px\">" + h.fournisseur + "</td><td style=\"padding:8px;font-size:11px\">" + h.periode + "</td><td style=\"padding:8px;font-size:11px\">" + (h.montant ? h.montant.toLocaleString("fr-FR")+" €" : "—") + "</td><td style=\"padding:8px;font-size:11px\">" + (h.kwh ? h.kwh.toLocaleString("fr-FR")+" kWh" : "—") + "</td><td style=\"padding:8px;font-size:11px\">" + (h.prix_kwh ? h.prix_kwh.toFixed(4)+" €" : "—") + "</td><td style=\"padding:8px;font-size:11px;color:" + (h.anomalies > 0 ? "#f87171" : "#4ade80") + "\">" + (h.anomalies > 0 ? "⚠ "+h.anomalies : "✅") + "</td><td style=\"padding:8px\"><span style=\"font-size:10px;padding:3px 8px;border-radius:20px;background:" + (h.statut==="Validé" ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)") + ";color:"+col+"\">" + h.statut + "</span></td></tr>";
            }).join("");
          }
        }
        var zone = document.getElementById("upload-result");
        if (zone) {
          zone.style.display = "block";
          var iconType = isContrat ? "📋" : "📄";
          var couleurType = isContrat ? "#60a5fa" : "#4ade80";
          zone.innerHTML = "<div style=\"padding:16px;background:rgba(163,230,53,0.06);border:1px solid rgba(163,230,53,0.2);border-radius:8px\"><div style=\"font-size:12px;font-weight:700;color:var(--volt);margin-bottom:12px\">✅ Analyse terminée — " + fileName + "</div><div style=\"display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px\"><div>" + iconType + " <strong style=\"color:" + couleurType + "\">" + (isContrat ? "CONTRAT" : "FACTURE") + "</strong></div><div>📋 " + (result.fournisseur||"—") + "</div><div>📅 " + (result.periode||"—") + "</div><div>📅 Fin : " + (result.date_fin_contrat||"—") + "</div><div>💰 " + (result.prix_kwh ? result.prix_kwh.toFixed(4)+" €/kWh" : "—") + "</div><div>⚡ " + (result.puissance_kva||"—") + " kVA</div>" + (!isContrat ? "<div>💶 " + (result.montant_ttc ? result.montant_ttc.toLocaleString("fr-FR")+" €" : "—") + "</div><div>⚡ " + (result.consommation_kwh ? result.consommation_kwh.toLocaleString("fr-FR")+" kWh" : "—") + "</div>" : "") + "</div>" + (result.anomalies && result.anomalies.length ? "<div style=\"margin-top:10px;padding:8px;background:rgba(248,113,113,0.1);border-radius:6px;font-size:11px;color:#f87171\">⚠️ " + result.anomalies.join(" · ") + "</div>" : "<div style=\"margin-top:10px;font-size:11px;color:#4ade80\">✅ Aucune anomalie</div>") + "</div>";
        }
        showToast("✅ " + (isContrat ? "Contrat" : "Facture") + " analysé" + (isContrat ? "" : "e") + " !");
      }
    } catch(e) { console.log("Erreur:",e); showToast("⚠ Erreur : "+e.message); }
  };
  reader.readAsDataURL(file);
}