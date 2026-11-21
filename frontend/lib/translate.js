import { apiFetch } from './api.js';

let debounceTimer = null;

export async function fetchHindiTranslation(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return '';
  }

  try {
    const res = await apiFetch(`/translate?text=${encodeURIComponent(text.trim())}`);
    return res?.translated || '';
  } catch (err) {
    console.warn('Auto-translate error:', err);
    return '';
  }
}

/**
 * Debounced translation helper to auto-populate Hindi while typing in English
 */
export function debounceTranslateToHindi(englishText, callback, delayMs = 450) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  if (!englishText || !englishText.trim()) {
    return;
  }

  debounceTimer = setTimeout(async () => {
    const translated = await fetchHindiTranslation(englishText);
    if (translated) {
      callback(translated);
    }
  }, delayMs);
}
