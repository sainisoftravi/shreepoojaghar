import { apiFetch } from './api.js';

let debounceTimer = null;

/**
 * Fetch Hindi translation and transliteration suggestions
 */
export async function fetchHindiWithSuggestions(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return { translated: '', suggestions: [] };
  }

  try {
    const res = await apiFetch(`/translate?text=${encodeURIComponent(text.trim())}`);
    const translated = res?.translated || '';
    const suggestions = Array.isArray(res?.suggestions) && res.suggestions.length > 0
      ? res.suggestions
      : (translated ? [translated] : []);
    return { translated, suggestions };
  } catch (err) {
    console.warn('Auto-translate error:', err);
    return { translated: '', suggestions: [] };
  }
}

/**
 * Fetch primary Hindi translation string
 */
export async function fetchHindiTranslation(text) {
  const res = await fetchHindiWithSuggestions(text);
  return res.translated;
}

/**
 * Debounced translation helper to auto-populate Hindi while typing in English
 */
export function debounceTranslateToHindi(englishText, callback, delayMs = 350) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  if (!englishText || !englishText.trim()) {
    return;
  }

  debounceTimer = setTimeout(async () => {
    const res = await fetchHindiWithSuggestions(englishText);
    if (res.translated) {
      callback(res.translated, res.suggestions);
    }
  }, delayMs);
}
