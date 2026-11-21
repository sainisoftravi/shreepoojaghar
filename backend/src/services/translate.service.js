import { logger } from '../config/logger.js';

const DICTIONARY = {
  'candle': 'मोमबत्ती',
  'candles': 'मोमबत्तियाँ',
  'pooja candle': 'पूजा मोमबत्ती',
  'pooja candles': 'पूजा मोमबत्तियाँ',
  'incense': 'अगरबत्ती',
  'incense sticks': 'अगरबत्ती',
  'agarbatti': 'अगरबत्ती',
  'dhoop': 'धूप',
  'dhoopbatti': 'धूपबत्ती',
  'camphor': 'कपूर',
  'kapur': 'कपूर',
  'ghee': 'घी',
  'pure desi ghee': 'शुद्ध देसी घी',
  'oil': 'तेल',
  'mustard oil': 'सरसों का तेल',
  'sesame oil': 'तिल का तेल',
  'diya': 'दीया',
  'mitti diya': 'मिट्टी का दीया',
  'brass diya': 'पीतल का दीया',
  'matchbox': 'माचिस',
  'cotton': 'रुई',
  'cotton wicks': 'रुई बत्ती',
  'batti': 'बत्ती',
  'gol batti': 'गोल बत्ती',
  'lambi batti': 'लम्बी बत्ती',
  'roli': 'रोली',
  'kumkum': 'कुमकुम',
  'chandan': 'चंदन',
  'chandan tika': 'चंदन टीका',
  'sindoor': 'सिंदूर',
  'supari': 'सुपारी',
  'sugar': 'चीनी',
  'chini': 'चीनी / शक्कर',
  'rice': 'चावल (अक्षत)',
  'akshat': 'अक्षत',
  'bell': 'घंटी',
  'pooja bell': 'पूजा की घंटी',
  'thali': 'थाली',
  'pooja thali': 'पूजा थाली',
  'gangajal': 'गंगाजल',
  'gulab jal': 'गुलाब जल',
  'ittar': 'इत्र',
  'attar': 'इत्र',
  'moli': 'मौली / कलावा',
  'kalawa': 'कलावा',
  'samagri': 'सामग्री',
  'pooja samagri': 'पूजा सामग्री',
  'havan': 'हवन',
  'havan samagri': 'हवन सामग्री',
  'janeu': 'जनेऊ',
  'loban': 'लोबान',
  'guggal': 'गुग्गल',
  'clove': 'लौंग',
  'laung': 'लौंग',
  'cardamom': 'इलायची',
  'elaichi': 'इलायची',
  'pack': 'पैक',
  'packet': 'पैकेट',
  'piece': 'पीस',
  'box': 'डिब्बा',
  'bottle': 'बोतल',
  'dozen': 'दर्जन',
  'kg': 'किग्रा',
  'litre': 'लीटर',
};

export const translateTextToHindi = async (text) => {
  if (!text || typeof text !== 'string') return '';
  const clean = text.trim();
  if (!clean) return '';

  const lower = clean.toLowerCase();
  if (DICTIONARY[lower]) {
    return DICTIONARY[lower];
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(clean)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map((item) => (item ? item[0] : '')).join('').trim();
        if (translated) return translated;
      }
    }
  } catch (err) {
    logger.warn({ err: err?.message, text: clean }, 'External translation service unavailable, using dictionary fallback');
  }

  // Word-by-word fallback
  const words = clean.split(/\s+/);
  const translatedWords = words.map((w) => DICTIONARY[w.toLowerCase()] || w);
  return translatedWords.join(' ');
};
