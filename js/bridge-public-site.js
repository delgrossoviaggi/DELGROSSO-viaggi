// DELGROSSO - Public Site Bridge
// SOLO Supabase SITO. Non importa js/delgrosso-api.js e non tocca il Gestionale.

const SITE_SUPABASE_URL = 'https://exphxbeqwpwrsigdmilc.supabase.co';
const SITE_SUPABASE_KEY = 'sb_publishable_jEq6R22qxk2SHGI5YEmEow_SfZG7j8c';

async function siteRows(table, select = '*', order = 'created_at.desc') {
  const endpoint =
    `${SITE_SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}` +
    `?select=${encodeURIComponent(select)}` +
    `&order=${encodeURIComponent(order)}`;

  const response = await fetch(endpoint, {
    headers: {
      apikey: SITE_SUPABASE_KEY,
      Authorization: `Bearer ${SITE_SUPABASE_KEY}`
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    let message = `Supabase SITO HTTP ${response.status}`;
    try {
      const body = await response.json();
      message = body?.message || body?.hint || message;
    } catch (_) {}
    throw new Error(message);
  }

  return response.json();
}

export async function getFlottaPubblicaSite() {
  try {
    const data = await siteRows(
      'flotta_page',
      'id,created_at,titolo,descrizione,immagine_url,foto_urls,foto_gallery'
    );

    return {
      success: true,
      data: Array.isArray(data) ? data : [],
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

export { SITE_SUPABASE_URL };
