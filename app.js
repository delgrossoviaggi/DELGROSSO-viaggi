const SUPABASE_URL = 'https://exphxbeqwpwrsigdmilc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jEq6R22qxk2SHGI5YEmEow_SfZG7j8c';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function caricaContenuti() {
    const { data, error } = await _supabase
        .from('viaggi')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Errore:", error);
        return;
    }

    const gridViaggi = document.getElementById('viaggi-grid');
    const gridEventi = document.getElementById('eventi-grid');
    
    gridViaggi.innerHTML = '';
    gridEventi.innerHTML = '';

    data.forEach(item => {
        const card = `
            <div class="luxury-card">
                <div class="badge">${item.descrizione || 'Disponibile'}</div>
                <img src="${item.immagine_url}" alt="${item.titolo}">
                <div class="card-content">
                    <h3>${item.titolo}</h3>
                    <a href="${item.link_prenotazione}" class="btn-luxury">PRENOTA ORA</a>
                </div>
            </div>
        `;

        if (item.categoria === 'evento') {
            gridEventi.innerHTML += card;
        } else {
            gridViaggi.innerHTML += card;
        }
    });
}

document.addEventListener('DOMContentLoaded', caricaContenuti);