// ══════════════════════════════════════════════════════
//  SEF 360° — Claude Engine v2.0
//  Analyse factures & contrats → alimente la Vue Globale
// ══════════════════════════════════════════════════════

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
            max_tokens: 2048,
            messages: [{ role: "user", content: [
              { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: "Analyse ce document energie. REGLES IMPORTANTES: (1) type_document = facture si cest une facture/releve de consommation avec un montant TTC a payer, contrat si cest un contrat/accord commercial sans montant a payer. (2) Le PDL electricite est un numero RAE de 14 chiffres commencant par 3 (ex: 30001234567890). Le PCE gaz commence par 0. Le SIRET est different du PDL. (3) fournisseur = vendeur commercial uniquement (jamais ENEDIS, GRDF, RTE). (4) Pour une FACTURE: extrait mois et annee de la periode de consommation (pas date emission). prix_kwh = prix unitaire HT en euros (ex: 0.0455 et non 4.55). (5) Pour un CONTRAT: mois=0, annee=0, montant_ht=0, montant_ttc=0. prix_kwh = prix contractuel unitaire HT en euros. Reponds UNIQUEMENT en JSON sur une seule ligne sans markdown: {\"type_document\":\"facture\",\"energie\":\"elec\",\"fournisseur\":\"\",\"pdl_pce\":\"\",\"nom_site\":\"\",\"adresse_site\":\"\",\"periode\":\"\",\"mois\":0,\"annee\":0,\"date_debut_contrat\":\"\",\"date_fin_contrat\":\"\",\"montant_ht\":0,\"montant_ttc\":0,\"consommation_kwh\":0,\"consommation_mwh\":0,\"prix_kwh\":0,\"puissance_kva\":0,\"formule_tarifaire\":\"\",\"cout_abonnement\":0,\"cout_energie\":0,\"cout_taxes\":0,\"budget_annuel_estime\":0,\"anomalies\":[]}" }
            ]}]
          }
        })
      });

      var data = await response.json();
      if (data.content && data.content[0]) {
        var text = data.content[0].text;
        console.log("Claude text:", text);
        var jsonMatch = text.match(/\{[\s\S]*\}/);
        var clean = jsonMatch ? jsonMatch[0].replace(/\n/g, " ").trim() : "{}";
        var result = JSON.parse(clean);

        var isContrat = result.type_document && result.type_document.includes("contrat");

        if (currentClientId && SEF_CLIENTS[currentClientId]) {
          var c = SEF_CLIENTS[currentClientId];

          if (!isContrat) {
            if (result.montant_ttc) c.facture = result.montant_ttc.toLocaleString("fr-FR") + " €";
            if (result.consommation_kwh) c.conso = result.consommation_kwh.toLocaleString("fr-FR") + " kWh";
            if (result.montant_ttc) c.budget_annuel = result.budget_annuel_estime || (result.montant_ttc * 12);
          }
          // Contrat : ne pas ecraser les donnees de facturation existantes
          if (result.prix_kwh && (!isContrat || !c.prix_kwh)) c.prix_kwh = result.prix_kwh;
          if (result.fournisseur && (!isContrat || !c.fournisseur)) c.fournisseur = result.fournisseur;
          if (result.pdl_pce) c.pdl = result.pdl_pce;
          if (result.puissance_kva) c.puissance = result.puissance_kva;
          if (result.date_fin_contrat) c.date_fin = result.date_fin_contrat;

          if (!c.historique) c.historique = [];
          c.historique.unshift({ nom: fileName, date: fileDate, type: result.type_document || "facture", energie: result.energie || "elec", fournisseur: result.fournisseur || "—", periode: result.periode || "—", mois: result.mois || 0, annee: result.annee || 0, montant: result.montant_ttc || 0, kwh: result.consommation_kwh || 0, prix_kwh: result.prix_kwh || 0, site: result.nom_site || "", pdl_pce: result.pdl_pce || "", anomalies: result.anomalies ? result.anomalies.length : 0, statut: result.anomalies && result.anomalies.length > 0 ? "Anomalie" : "Validé" });

          if (!isContrat && result.mois && result.annee) {
            if (!c.mensuel) c.mensuel = [];
            var cleM = result.annee + "-" + String(result.mois).padStart(2, "0");
            var moisLabel = _moisLabel(result.mois, result.annee);
            var mExist = c.mensuel.find(function(m) { return m.cle === cleM && m.energie === result.energie; });
            if (mExist) {
              mExist.montant = result.montant_ttc || mExist.montant;
              mExist.kwh = result.consommation_kwh || mExist.kwh;
              mExist.prix_kwh = result.prix_kwh || mExist.prix_kwh;
            } else {
              c.mensuel.push({ cle: cleM, label: moisLabel, mois: result.mois, annee: result.annee, energie: result.energie || "elec", montant: result.montant_ttc || 0, kwh: result.consommation_kwh || 0, prix_kwh: result.prix_kwh || 0, pdl_pce: result.pdl_pce || "", site: result.nom_site || "" });
            }
            c.mensuel.sort(function(a, b) { return a.cle.localeCompare(b.cle); });
          }

          if (result.pdl_pce) {
            if (!c.pdls) c.pdls = [];
            var pdlExist = c.pdls.find(function(p) { return p.pdl === result.pdl_pce; });
            if (!pdlExist) {
              c.pdls.push({ pdl: result.pdl_pce, type: result.energie || "elec", fournisseur: result.fournisseur || "", puissance: result.puissance_kva || 0, formule: result.formule_tarifaire || "", date_fin: result.date_fin_contrat || "", prix_kwh: result.prix_kwh || 0, site: result.nom_site || "", adresse: result.adresse_site || "", conso_annuelle: result.consommation_kwh ? result.consommation_kwh * 12 : 0, cout_mensuel: result.montant_ttc || 0 });
              showToast("✅ PDL " + result.pdl_pce + " ajouté !");
            } else {
              if (result.fournisseur) pdlExist.fournisseur = result.fournisseur;
              if (result.puissance_kva) pdlExist.puissance = result.puissance_kva;
              if (result.formule_tarifaire) pdlExist.formule = result.formule_tarifaire;
              if (result.date_fin_contrat) pdlExist.date_fin = result.date_fin_contrat;
              if (result.prix_kwh) pdlExist.prix_kwh = result.prix_kwh;
              if (result.nom_site) pdlExist.site = result.nom_site;
              if (result.montant_ttc) pdlExist.cout_mensuel = result.montant_ttc;
              if (result.consommation_kwh) pdlExist.conso_annuelle = result.consommation_kwh * 12;
              showToast("✅ PDL " + result.pdl_pce + " mis à jour !");
            }
          }

          saveClients();
          _updateVueGlobale(c, result, isContrat);
          setTimeout(function() { renderPdlRepartition(); _renderGraphiques(c); }, 200);
        }
        _renderUploadResult(result, fileName, isContrat);
        showToast("✅ " + (isContrat ? "Contrat" : "Facture") + " analysé" + (isContrat ? "" : "e") + " !");
      }
    } catch(e) { console.log("Erreur:", e); showToast("⚠ Erreur : " + e.message); }
  };
  reader.readAsDataURL(file);
}

function _updateVueGlobale(c, result, isContrat) {
  var t = function(id, v) { var el = document.getElementById(id); if (el && v !== undefined && v !== "") el.textContent = v; };
  if (!isContrat) { t("kpi-facture-display", c.facture); t("kpi-conso-display", c.conso); t("d-facture", c.facture); t("d-conso", c.conso); }
  if (result.prix_kwh) { t("kpi-prix-display", result.prix_kwh.toFixed(4) + " €/kWh"); t("rp-prix", result.prix_kwh.toFixed(4) + " €/kWh"); }
  if (c.budget_annuel) t("kpi-budget-display", c.budget_annuel.toLocaleString("fr-FR") + " €");
  var tbody = document.getElementById("factures-tbody");
  if (tbody && c.historique) {
    tbody.innerHTML = c.historique.map(function(h) {
      var badge = h.type === "contrat" ? "📋" : (h.energie === "gaz" ? "🔥" : "📄");
      var col = h.statut === "Validé" ? "#4ade80" : "#f87171";
      return "<tr style=\"border-bottom:1px solid rgba(255,255,255,0.05)\"><td style=\"padding:8px;font-size:11px\">" + badge + " " + h.nom + "<br><span style=\"color:var(--text2);font-size:10px\">" + h.date + "</span></td><td style=\"padding:8px;font-size:11px\">" + h.fournisseur + "</td><td style=\"padding:8px;font-size:11px\">" + h.periode + "</td><td style=\"padding:8px;font-size:11px\">" + (h.montant ? h.montant.toLocaleString("fr-FR") + " €" : "—") + "</td><td style=\"padding:8px;font-size:11px\">" + (h.kwh ? h.kwh.toLocaleString("fr-FR") + " kWh" : "—") + "</td><td style=\"padding:8px;font-size:11px\">" + (h.prix_kwh ? h.prix_kwh.toFixed(4) + " €" : "—") + "</td><td style=\"padding:8px;font-size:11px;color:" + (h.anomalies > 0 ? "#f87171" : "#4ade80") + "\">" + (h.anomalies > 0 ? "⚠ " + h.anomalies : "✅") + "</td><td style=\"padding:8px\"><span style=\"font-size:10px;padding:3px 8px;border-radius:20px;background:" + (h.statut === "Validé" ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)") + ";color:" + col + "\">" + h.statut + "</span></td></tr>";
    }).join("");
  }
}

function _renderGraphiques(c) {
  if (!c.mensuel || c.mensuel.length === 0) return;
  var mensuel = c.mensuel;
  var elec = mensuel.filter(function(m) { return m.energie === "elec"; });
  var gaz = mensuel.filter(function(m) { return m.energie === "gaz"; });
  var derniers = mensuel.slice(-12);
  var labels = derniers.map(function(m) { return m.label; });
  var consos = derniers.map(function(m) { return m.kwh; });
  var couts = derniers.map(function(m) { return m.montant; });
  var prix = derniers.map(function(m) { return m.prix_kwh; });
  _drawBarChart("chart-conso-mois", labels, consos, "#38bdf8", "kWh");
  _drawBarChart("chart-conso-mois-main", labels, consos, "#38bdf8", "kWh");
  _drawLineChart("chart-cout-mois", labels, couts, "#a3e635", "€");
  _drawLineChart("chart-cout-mois-main", labels, couts, "#a3e635", "€");
  _drawLineChart("chart-prix-kwh", labels, prix, "#c084fc", "€/kWh");
  _drawLineChart("chart-prix-kwh-main", labels, prix, "#c084fc", "€/kWh");
  var totalElec = elec.reduce(function(s, m) { return s + m.montant; }, 0);
  var totalGaz = gaz.reduce(function(s, m) { return s + m.montant; }, 0);
  _drawDonut("chart-repartition", totalElec, totalGaz);
  _renderTableSites(c);
}

function _drawBarChart(canvasId, labels, values, color, unite) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var W = canvas.width, H = canvas.height;
  var pad = { top: 20, right: 10, bottom: 40, left: 55 };
  ctx.clearRect(0, 0, W, H);
  if (!values || values.length === 0) return;
  var max = Math.max.apply(null, values) || 1;
  var bW = (W - pad.left - pad.right) / values.length;
  var bPad = bW * 0.2;
  values.forEach(function(v, i) {
    var bH = (v / max) * (H - pad.top - pad.bottom);
    var x = pad.left + i * bW + bPad / 2;
    var y = H - pad.bottom - bH;
    ctx.fillStyle = color + "55"; ctx.fillRect(x, y, bW - bPad, bH);
    ctx.strokeStyle = color; ctx.strokeRect(x, y, bW - bPad, bH);
  });
  ctx.fillStyle = "#8899aa"; ctx.font = "9px monospace"; ctx.textAlign = "center";
  labels.forEach(function(l, i) { ctx.fillText(l.slice(0,6), pad.left + i * bW + bW/2, H - pad.bottom + 14); });
  ctx.textAlign = "right";
  [0, 0.5, 1].forEach(function(f) {
    var y = H - pad.bottom - f * (H - pad.top - pad.bottom);
    ctx.fillText((max * f).toFixed(0), pad.left - 4, y + 3);
    ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
  });
  ctx.fillStyle = "#8899aa"; ctx.textAlign = "left"; ctx.fillText(unite, 2, pad.top);
}

function _drawLineChart(canvasId, labels, values, color, unite) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var W = canvas.width, H = canvas.height;
  var pad = { top: 20, right: 10, bottom: 40, left: 55 };
  ctx.clearRect(0, 0, W, H);
  if (!values || values.length < 2) return;
  var max = Math.max.apply(null, values) || 1;
  var min = Math.min.apply(null, values);
  var range = max - min || 1;
  var step = (W - pad.left - pad.right) / (values.length - 1);
  var pts = values.map(function(v, i) { return { x: pad.left + i * step, y: H - pad.bottom - ((v - min) / range) * (H - pad.top - pad.bottom) }; });
  ctx.beginPath(); ctx.moveTo(pts[0].x, H - pad.bottom);
  pts.forEach(function(p) { ctx.lineTo(p.x, p.y); });
  ctx.lineTo(pts[pts.length-1].x, H - pad.bottom); ctx.closePath();
  ctx.fillStyle = color + "22"; ctx.fill();
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2;
  pts.forEach(function(p, i) { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); }); ctx.stroke();
  pts.forEach(function(p) { ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fillStyle = color; ctx.fill(); });
  ctx.fillStyle = "#8899aa"; ctx.font = "9px monospace"; ctx.textAlign = "center";
  labels.forEach(function(l, i) { ctx.fillText(l.slice(0,6), pad.left + i * step, H - pad.bottom + 14); });
  ctx.textAlign = "right";
  [0, 0.5, 1].forEach(function(f) {
    var y = H - pad.bottom - f * (H - pad.top - pad.bottom);
    ctx.fillText((min + range * f).toFixed(4), pad.left - 4, y + 3);
  });
  ctx.fillStyle = "#8899aa"; ctx.textAlign = "left"; ctx.fillText(unite, 2, pad.top);
}

function _drawDonut(canvasId, elec, gaz) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  var total = elec + gaz; if (total === 0) return;
  var cx = W/2, cy = H/2, r = Math.min(W,H)/2 - 20, ir = r * 0.55;
  var start = -Math.PI/2;
  [{val:elec,color:"#38bdf8"},{val:gaz,color:"#fb923c"}].forEach(function(a) {
    var sweep = (a.val/total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+sweep); ctx.closePath();
    ctx.fillStyle = a.color; ctx.fill(); start += sweep;
  });
  ctx.beginPath(); ctx.arc(cx,cy,ir,0,Math.PI*2); ctx.fillStyle = "#0d1220"; ctx.fill();
  ctx.fillStyle = "#f0f2f7"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center";
  ctx.fillText(Math.round(elec/total*100)+"%", cx, cy-5);
  ctx.fillStyle = "#8899aa"; ctx.font = "9px monospace"; ctx.fillText("Élec", cx, cy+10);
}

function _renderTableSites(c) {
  var el = document.getElementById("tableau-sites");
  if (!el || !c.pdls || c.pdls.length === 0) return;
  el.innerHTML = "<table class=\"tbl\" style=\"width:100%\"><thead><tr><th>Site</th><th>PDL/PCE</th><th>Énergie</th><th>Fournisseur</th><th>Puissance</th><th>Prix €/kWh</th><th>Coût/mois</th><th>Fin contrat</th></tr></thead><tbody>"
    + c.pdls.map(function(p) {
        var col = p.type === "elec" ? "var(--elec)" : "var(--gaz)";
        var danger = p.date_fin && p.date_fin.includes("2026") ? "var(--red)" : "var(--green)";
        return "<tr><td style=\"font-weight:600\">" + (p.site || p.adresse || "—") + "</td><td style=\"font-family:var(--mono);font-size:11px;color:" + col + "\">" + (p.pdl||"—") + "</td><td style=\"color:" + col + "\">" + (p.type==="elec" ? "⚡ Élec" : "🔥 Gaz") + "</td><td>" + (p.fournisseur||"—") + "</td><td style=\"font-family:var(--mono)\">" + (p.puissance ? p.puissance+" kVA" : "—") + "</td><td style=\"font-family:var(--mono);color:var(--purple)\">" + (p.prix_kwh ? p.prix_kwh.toFixed(4)+" €" : "—") + "</td><td style=\"font-family:var(--mono);color:var(--elec)\">" + (p.cout_mensuel ? p.cout_mensuel.toLocaleString("fr-FR")+" €" : "—") + "</td><td style=\"font-family:var(--mono);color:" + danger + "\">" + (p.date_fin||"—") + "</td></tr>";
      }).join("") + "</tbody></table>";
}

function _renderUploadResult(result, fileName, isContrat) {
  var zone = document.getElementById("upload-result");
  if (!zone) return;
  zone.style.display = "block";
  var icon = isContrat ? "📋" : (result.energie === "gaz" ? "🔥" : "📄");
  zone.innerHTML = "<div style=\"padding:16px;background:rgba(163,230,53,0.06);border:1px solid rgba(163,230,53,0.2);border-radius:8px\"><div style=\"font-size:12px;font-weight:700;color:var(--volt);margin-bottom:12px\">✅ Analyse terminée — " + fileName + "</div><div style=\"display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px\"><div>" + icon + " <strong>" + (isContrat ? "CONTRAT" : "FACTURE") + " " + (result.energie||"").toUpperCase() + "</strong></div><div>🏢 " + (result.nom_site||result.fournisseur||"—") + "</div><div>📋 " + (result.fournisseur||"—") + "</div><div>📅 " + (result.periode||result.date_debut_contrat||"—") + "</div><div>🔢 PDL : " + (result.pdl_pce||"—") + "</div><div>📅 Fin : " + (result.date_fin_contrat||"—") + "</div><div>💰 " + (result.prix_kwh ? result.prix_kwh.toFixed(4)+" €/kWh" : "—") + "</div><div>⚡ " + (result.puissance_kva||"—") + " kVA</div>" + (!isContrat ? "<div>💶 " + (result.montant_ttc ? result.montant_ttc.toLocaleString("fr-FR")+" €" : "—") + "</div><div>⚡ " + (result.consommation_kwh ? result.consommation_kwh.toLocaleString("fr-FR")+" kWh" : "—") + "</div>" : "") + "</div>" + (result.anomalies && result.anomalies.length ? "<div style=\"margin-top:10px;padding:8px;background:rgba(248,113,113,0.1);border-radius:6px;font-size:11px;color:#f87171\">⚠️ " + result.anomalies.join(" · ") + "</div>" : "<div style=\"margin-top:10px;font-size:11px;color:#4ade80\">✅ Aucune anomalie</div>") + "</div>";
}

function _moisLabel(mois, annee) {
  var noms = ["","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
  return (noms[mois]||"?") + " " + String(annee).slice(2);
}

function refreshGraphiques(clientId) {
  var c = SEF_CLIENTS[clientId || currentClientId];
  if (c) _renderGraphiques(c);
}
