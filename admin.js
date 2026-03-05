const SUPABASE_URL = 'https://exphxbeqwpwrsigdmilc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jEq6R22qxk2SHGI5YEmEow_SfZG7j8c';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Carica la lista dei viaggi attivi per la gestione
async function renderAdminList() {
    const { data, error } = await _supabase.from('viaggi').select('*').order('created_at', { ascending: false });
    const listDiv = document.getElementById('admin-list');
    listDiv.innerHTML = '';

    if (error) return console.error(error);

    data.forEach(item => {
        listDiv.innerHTML += `
            <div class="admin-item-card">
                <img src="${item.immagine_url}" alt="Anteprima">
                <div class="admin-item-info">
                    <h4>${item.titolo}</h4>
                    <p>${item.categoria.toUpperCase()}</p>
                    <button onclick="eliminaViaggio(${item.id}, '${item.immagine_url}')" class="btn-delete">ELIMINA</button>
                </div>
            </div>
        `;
    });
}

// Funzione per eliminare viaggio e immagine
async function eliminaViaggio(id, imageUrl) {
    const pass = document.getElementById('adminPass').value;
    if (pass !== 'DELGROSSO2026') return alert("Password richiesta per eliminare!");

    if (!confirm("Sei sicuro di voler rimuovere questa locandina?")) return;

    const urlParts = imageUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const bucketName = imageUrl.includes('/eventi/') ? 'eventi' : 'foto';

    const { error: dbError } = await _supabase.from('viaggi').delete().eq('id', id);
    await _supabase.storage.from(bucketName).remove([fileName]);

    if (dbError) alert("Errore durante l'eliminazione");
    else {
        alert("Rimosso con successo!");
        renderAdminList();
    }
}

// Funzione per pubblicare
async function pubblica() {
    const pass = document.getElementById('adminPass').value;
    if (pass !== 'DELGROSSO2026') return alert("Password Errata!");

    const file = document.getElementById('fotoFile').files[0];
    const titolo = document.getElementById('titolo').value;
    const desc = document.getElementById('desc').value;
    const link = document.getElementById('link').value;
    const cat = document.getElementById('categoria').value;

    if (!file || !titolo) return alert("Inserisci almeno titolo e immagine!");

    const bucketNome = (cat === 'evento') ? 'eventi' : 'foto';
    const fileName = `${Date.now()}_${file.name}`;
    
    // Upload Storage
    const { data: uploadData, error: uploadError } = await _supabase.storage.from(bucketNome).upload(fileName, file);
    if (uploadError) return alert("Errore Foto: " + uploadError.message);

    // Get URL e Salva su DB
    const { data: urlData } = _supabase.storage.from(bucketNome).getPublicUrl(fileName);
    const { error: dbError } = await _supabase.from('viaggi').insert([
        { titolo, descrizione: desc, immagine_url: urlData.publicUrl, link_prenotazione: link, categoria: cat }
    ]);

    if (dbError) alert("Errore Database!");
    else {
        alert("LOCANDINA ONLINE!");
        location.reload();
    }
}

document.addEventListener('DOMContentLoaded', renderAdminList);