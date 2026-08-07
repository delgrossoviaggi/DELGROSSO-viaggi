const SETTINGS_CACHE_KEY = 'dg_runtime_settings_cache_v2';

function readRuntimeSettingsOverride(key) {
  if (typeof window === 'undefined' || !window.localStorage) return '';
  try {
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    const config = parsed?.configurazioni || {};
    if (key === 'VITE_SUPABASE_URL') return config.supabaseUrl || '';
    if (key === 'VITE_SUPABASE_ANON_KEY') return config.supabaseAnonKey || '';
    if (key === 'VITE_SUPABASE_BUCKET_LOCANDINE') return config.storageBucketLocandine || '';
    if (key === 'VITE_SUPABASE_BUCKET_RICEVUTE') return config.storageBucketRicevute || '';
    if (key === 'VITE_STORAGE_PUBLIC_BASE_URL') return config.storagePublicBaseUrl || '';
    return '';
  } catch (_error) {
    return '';
  }
}

export function getRuntimeEnv() {
  if (typeof import.meta === 'object' && import.meta.env) {
    return import.meta.env;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  return {};
}

export function getOptionalEnv(key, fallback = '') {
  const env = getRuntimeEnv();
  const runtimeOverride = readRuntimeSettingsOverride(key);
  const value = runtimeOverride || env?.[key];
  return value === undefined || value === null || value === '' ? fallback : value;
}

export function getRequiredEnv(key) {
  const value = getOptionalEnv(key, '');
  if (!value) {
    throw new Error(`Configurazione mancante: ${key}`);
  }
  return value;
}
