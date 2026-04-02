const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loadClientsFromDB() {
  try {
    const { data, error } = await db.from('organizations').select('*');
    if (error) { console.log('Supabase:', error.message); return; }
    if (data && data.length > 0) {
      data.forEach(function(org) {
        SEF_CLIENTS['db_' + org.id] = {
          nom: org.name || '',
          siret: org.siret || '',
          ville: org.city || '',
          adresse: org.address || '',
          pdls: [],
          facture:'—', conso:'—', eco:'—', carbon:'—', prevision:'—'
        };
      });
      rebuildClientSelector();
      showToast('✅ ' + data.length + ' client(s) chargé(s)');
    }
  } catch(e) { console.log('Erreur:', e); }
}

var _origSaveNouveauClient = window.saveNouveauClient;
window.saveNouveauClient = async function() {
  var nom = document.getElementById('nc-nom');
  if (!nom || !nom.value.trim()) {
    if (nom) nom.style.borderColor='rgba(248,113,113,0.5)';
    showToast('⚠ La raison sociale est obligatoire');
    return;
  }
  var clientData = {
    name:    document.getElementById('nc-nom')?.value.trim() || '',
    siret:   document.getElementById('nc-siret')?.value.trim() || '',
    city:    document.getElementById('nc-ville')?.value.trim() || '',
    address: document.getElementById('nc-adresse')?.value.trim() || ''
  };
  try {
    const { data, error } = await db.from('organizations').insert([clientData]).select();
    if (error) {
      console.log('Erreur Supabase:', error.message);
      showToast('⚠ Erreur — ' + error.message);
      return;
    }
    if (data && data[0]) {
      var id = 'db_' + data[0].id;
      SEF_CLIENTS[id] = {
        nom: clientData.name, siret: clientData.siret,
        ville: clientData.city, adresse: clientData.address,
        pdls: [], facture:'—', conso:'—', eco:'—', carbon:'—', prevision:'—'
      };
      saveClients();
      rebuildClientSelector();
      closeNouveauClient();
      switchClient(id);
      nav('dashboard', document.querySelector('.nav-item'));
      showToast('✅ Client enregistré : ' + clientData.name);
    }
  } catch(e) { console.log('Erreur:', e); }
};

window.addEventListener('load', function() {
  setTimeout(loadClientsFromDB, 1000);
});