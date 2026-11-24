import { Router } from 'express';
import { translateTextToHindi } from '../services/translate.service.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const text = String(req.query.text || req.query.q || '').trim();
    if (!text) {
      return res.json({ success: true, text: '', translated: '', suggestions: [] });
    }
    const result = await translateTextToHindi(text);
    const translated = typeof result === 'object' ? (result.translated || '') : (result || '');
    const suggestions = typeof result === 'object' ? (result.suggestions || []) : [translated];
    res.json({ success: true, text, translated, suggestions });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const text = String(req.body.text || req.body.q || '').trim();
    if (!text) {
      return res.json({ success: true, text: '', translated: '', suggestions: [] });
    }
    const result = await translateTextToHindi(text);
    const translated = typeof result === 'object' ? (result.translated || '') : (result || '');
    const suggestions = typeof result === 'object' ? (result.suggestions || []) : [translated];
    res.json({ success: true, text, translated, suggestions });
  } catch (error) {
    next(error);
  }
});

export default router;
