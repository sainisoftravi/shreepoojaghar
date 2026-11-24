import { logger } from '../config/logger.js';

const hasDevanagari = (str) => typeof str === 'string' && /[\u0900-\u097F]/.test(str);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const DICTIONARY = {
  // Spices & Kirana (User highlighted: daal cheeni / dalchini / cinnamon)
  'cinnamon': 'दालचीनी',
  'daal cheeni': 'दालचीनी',
  'dal cheeni': 'दालचीनी',
  'dalchini': 'दालचीनी',
  'daalchini': 'दालचीनी',
  'daal chine': 'दालचीनी',
  'dal chini': 'दालचीनी',
  'daal chini': 'दालचीनी',
  'clove': 'लौंग',
  'cloves': 'लौंग',
  'laung': 'लौंग',
  'long': 'लौंग',
  'cardamom': 'इलायची',
  'cardamoms': 'इलायची',
  'elaichi': 'इलायची',
  'chhoti elaichi': 'छोटी इलायची',
  'badi elaichi': 'बड़ी इलायची',
  'black cardamom': 'बड़ी इलायची',
  'haldi': 'हल्दी',
  'turmeric': 'हल्दी',
  'haldi powder': 'हल्दी पाउडर',
  'haldi gath': 'हल्दी गांठ',
  'mirch': 'मिर्च',
  'lal mirch': 'लाल मिर्च',
  'red chilli': 'लाल मिर्च',
  'dhania': 'धनिया',
  'coriander': 'धनिया',
  'sabut dhania': 'साबुत धनिया',
  'jeera': 'जीरा',
  'cumin': 'जीरा',
  'saunf': 'सौंफ',
  'fennel': 'सौंफ',
  'ajwain': 'अजवाइन',
  'carom seeds': 'अजवाइन',
  'methi': 'मेथी दाना',
  'fenugreek': 'मेथी दाना',
  'sarson': 'सरसों',
  'mustard': 'सरसों',
  'pili sarson': 'पीली सरसों',
  'yellow mustard': 'पीली सरसों',
  'kali sarson': 'काली सरसों',
  'til': 'तिल',
  'kala til': 'काला तिल',
  'black sesame': 'काला तिल',
  'safed til': 'सफेद तिल',
  'white sesame': 'सफेद तिल',
  'sesame': 'तिल',
  'sesame seeds': 'तिल',
  'jau': 'जौ',
  'barley': 'जौ',
  'nariyal': 'नारियल',
  'coconut': 'नारियल',
  'sukha nariyal': 'सूखा नारियल',
  'gola': 'गोला (सूखा नारियल)',
  'pani nariyal': 'पानी वाला नारियल',
  'pani wala nariyal': 'पानी वाला नारियल',
  'namak': 'नमक',
  'salt': 'नमक',
  'sendha namak': 'सेंधा नमक',
  'rock salt': 'सेंधा नमक',
  'kala namak': 'काला नमक',
  'sugar': 'चीनी',
  'chini': 'चीनी',
  'bura': 'बूरा',
  'shakkar': 'शक्कर',
  'jaggery': 'गुड़',
  'gud': 'गुड़',
  'gur': 'गुड़',
  'makhana': 'मखाना',
  'fox nuts': 'मखाना',
  'kaju': 'काजू',
  'cashew': 'काजू',
  'badam': 'बादाम',
  'almond': 'बादाम',
  'kismis': 'किशमिश',
  'kishmish': 'किशमिश',
  'raisins': 'किशमिश',
  'pista': 'पिस्ता',
  'pistachio': 'पिस्ता',
  'akhrot': 'अखरोट',
  'walnut': 'अखरोट',
  'chhuhara': 'छुहारा',
  'dry dates': 'छुहारा',

  // Candles, Matchbox & Lighting
  'candle': 'मोमबत्ती',
  'candles': 'मोमबत्तियाँ',
  'pooja candle': 'पूजा मोमबत्ती',
  'pooja candles': 'पूजा मोमबत्तियाँ',
  'matchbox': 'माचिस',
  'matchsticks': 'माचिस',
  'maachis': 'माचिस',
  'diya': 'दीया',
  'diyas': 'दीये',
  'mitti diya': 'मिट्टी का दीया',
  'mitti ka diya': 'मिट्टी का दीया',
  'brass diya': 'पीतल का दीया',
  'akhand diya': 'अखंड दीया',
  'deepak': 'दीपक',
  'cotton': 'रुई',
  'cotton wicks': 'रुई बत्ती',
  'cotton batti': 'रुई बत्ती',
  'batti': 'बत्ती',
  'gol batti': 'गोल बत्ती',
  'lambi batti': 'लम्बी बत्ती',
  'phool batti': 'फूल बत्ती',

  // Fragrance & Incense
  'incense': 'अगरबत्ती',
  'incense sticks': 'अगरबत्ती',
  'agarbatti': 'अगरबत्ती',
  'agarbatti pack': 'अगरबत्ती पैकेट',
  'dhoop': 'धूप',
  'dhoopbatti': 'धूपबत्ती',
  'dhoop batti': 'धूपबत्ती',
  'dhoop cone': 'धूप कोन',
  'dhoop stick': 'धूप स्टिक',
  'sambrani': 'साम्ब्रानी कप',
  'sambrani cup': 'साम्ब्रानी कप',
  'loban': 'लोबान',
  'guggal': 'गुग्गल',
  'guggul': 'गुग्गल',
  'ittar': 'इत्र',
  'attar': 'इत्र',
  'perfume': 'इत्र',

  // Sacred Liquids & Oils
  'gangajal': 'गंगाजल',
  'ganga jal': 'गंगाजल',
  'gulab jal': 'गुलाब जल',
  'rose water': 'गुलाब जल',
  'ghee': 'घी',
  'pure desi ghee': 'शुद्ध देसी घी',
  'desi ghee': 'देसी घी',
  'cow ghee': 'गाय का देसी घी',
  'pooja ghee': 'पूजा घी',
  'oil': 'तेल',
  'mustard oil': 'सरसों का तेल',
  'sarson oil': 'सरसों का तेल',
  'sarson tel': 'सरसों का तेल',
  'sesame oil': 'तिल का तेल',
  'til oil': 'तिल का तेल',
  'til tel': 'तिल का तेल',
  'chameli oil': 'चमेली का तेल',
  'pooja oil': 'पूजा का तेल',

  // Pooja Samagri & Puja Essentials
  'samagri': 'सामग्री',
  'pooja samagri': 'पूजा सामग्री',
  'puja samagri': 'पूजा सामग्री',
  'havan': 'हवन',
  'havan samagri': 'हवन सामग्री',
  'camphor': 'कपूर',
  'kapoor': 'कपूर',
  'kapur': 'कपूर',
  'bhimseni kapoor': 'भीमसेनी कपूर',
  'roli': 'रोली',
  'kumkum': 'कुमकुम',
  'chandan': 'चंदन',
  'chandan tika': 'चंदन टीका',
  'safed chandan': 'सफेद चंदन',
  'lal chandan': 'लाल चंदन',
  'sindoor': 'सिंदूर',
  'hanuman sindoor': 'हनुमान सिंदूर',
  'supari': 'सुपारी',
  'pooja supari': 'पूजा सुपारी',
  'betel nut': 'सुपारी',
  'paan': 'पान का पत्ता',
  'akshat': 'अक्षत (चावल)',
  'rice': 'चावल (अक्षत)',
  'chawal': 'चावल (अक्षत)',
  'moli': 'मौली / कलावा',
  'kalawa': 'कलावा',
  'moli dhaga': 'मौली धागा',
  'raksha sutra': 'रक्षा सूत्र',
  'janeu': 'जनेऊ',
  'yajnopavita': 'यज्ञोपवीत (जनेऊ)',
  'kashti': 'कश्ती',
  'kheel': 'खील',
  'batashe': 'बताशे',
  'mishri': 'मिश्री',

  // Utensils & Accessories
  'bell': 'घंटी',
  'pooja bell': 'पूजा की घंटी',
  'ghanti': 'घंटी',
  'thali': 'थाली',
  'pooja thali': 'पूजा थाली',
  'aarti thali': 'आरती थाली',
  'lota': 'लोटा',
  'kalash': 'कलश',
  'pooja kalash': 'पूजा कलश',
  'shankh': 'शंख',
  'pooja shankh': 'पूजा शंख',
  'bajot': 'बाजोट (पूजा चौकी)',
  'chouki': 'पूजा चौकी',
  'chunri': 'चुनरी',
  'mata ki chunri': 'माता की चुनरी',
  'vastra': 'भगवान के वस्त्र',
  'asanam': 'आसन',
  'aasan': 'पूजा आसन',
  'mala': 'माला',
  'rudraksha': 'रुद्राक्ष माला',
  'tulsi mala': 'तुलसी माला',

  // Units
  'pack': 'पैक',
  'packet': 'पैकेट',
  'piece': 'पीस',
  'box': 'डिब्बा',
  'bottle': 'बोतल',
  'dozen': 'दर्जन',
  'kg': 'किग्रा',
  'gram': 'ग्राम',
  'litre': 'लीटर',
  'ml': 'मिलीलीटर',
  'bori': 'बोरी',
  'tin': 'टीन',
  'carton': 'कार्टन',
};

/**
 * Intelligent English-to-Hindi translation & Google Indic Typing transliteration.
 * Works for:
 * 1. Phonetic typing / Hinglish (e.g. "daal cheeni" -> "दालचीनी", "agarbatti" -> "अगरबत्ती")
 * 2. Pure English words (e.g. "cinnamon" -> "दालचीनी", "candle" -> "मोमबत्ती")
 * 3. Curated Pooja & Kirana dictionary
 */
export const translateTextToHindi = async (text) => {
  if (!text || typeof text !== 'string') return { translated: '', suggestions: [] };
  const clean = text.trim();
  if (!clean) return { translated: '', suggestions: [] };

  // If already Devanagari script, return as-is
  if (hasDevanagari(clean)) {
    return { translated: clean, suggestions: [clean] };
  }

  const lower = clean.toLowerCase();

  // 1. Direct Dictionary Match
  if (DICTIONARY[lower]) {
    const direct = DICTIONARY[lower];
    return { translated: direct, suggestions: [direct] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  // 2. Query Google Translate AND Google Input Tools (Transliteration) in parallel
  const [gtRes, itRes] = await Promise.allSettled([
    (async () => {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=hi&dt=t&q=${encodeURIComponent(clean)}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': UA },
      });
      if (!res.ok) return '';
      const data = await res.json();
      return (data[0] || []).map((x) => (x ? x[0] : '')).join('').trim();
    })(),
    (async () => {
      const url = `https://inputtools.google.com/request?text=${encodeURIComponent(clean)}&itc=hi-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': UA },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data[1]?.[0]?.[1] || []).map((s) => String(s).trim()).filter(Boolean);
    })(),
  ]);

  clearTimeout(timeout);

  const gt = gtRes.status === 'fulfilled' ? gtRes.value : '';
  const itList = itRes.status === 'fulfilled' ? itRes.value : [];

  const gtHasHindi = hasDevanagari(gt) && gt.toLowerCase() !== lower;
  const itHasHindi = itList.length > 0 && hasDevanagari(itList[0]);

  let best = '';
  const suggestionsSet = new Set();

  if (gtHasHindi) {
    best = gt;
    suggestionsSet.add(gt);
  }

  if (itHasHindi) {
    if (!best) {
      best = itList[0];
    }
    for (const c of itList) {
      if (hasDevanagari(c)) suggestionsSet.add(c);
    }
  }

  // 3. Fallback: Word-by-word dictionary transliteration
  if (!best) {
    const words = clean.split(/\s+/);
    const mapped = words.map((w) => DICTIONARY[w.toLowerCase()] || w);
    best = mapped.join(' ');
  }

  const suggestions = Array.from(suggestionsSet).slice(0, 5);
  return { translated: best, suggestions };
};
