import * as dbsyncService from '../services/dbsync.service.js';

export const getCredentials = async (req, res, next) => {
  try {
    const data = await dbsyncService.getSupabaseCredentials();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const saveCredentials = async (req, res, next) => {
  try {
    const { supabaseDirectUrl } = req.body;
    if (!supabaseDirectUrl) {
      return res.status(400).json({ success: false, message: 'supabaseDirectUrl is required' });
    }
    await dbsyncService.saveSupabaseCredentials(supabaseDirectUrl);
    res.json({ success: true, message: 'Credentials saved successfully' });
  } catch (error) {
    next(error);
  }
};

export const testConnection = async (req, res, next) => {
  try {
    const { supabaseDirectUrl } = req.body;
    if (!supabaseDirectUrl) {
      return res.status(400).json({ success: false, message: 'supabaseDirectUrl is required' });
    }
    const result = await dbsyncService.testConnection(supabaseDirectUrl);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: `Connection failed: ${error.message}` });
  }
};

export const pushToSupabase = async (req, res, next) => {
  try {
    const { supabaseDirectUrl } = req.body;
    if (!supabaseDirectUrl) {
      return res.status(400).json({ success: false, message: 'supabaseDirectUrl is required' });
    }
    const result = await dbsyncService.pushToSupabase(supabaseDirectUrl);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const pullFromSupabase = async (req, res, next) => {
  try {
    const { supabaseDirectUrl } = req.body;
    if (!supabaseDirectUrl) {
      return res.status(400).json({ success: false, message: 'supabaseDirectUrl is required' });
    }
    const result = await dbsyncService.pullFromSupabase(supabaseDirectUrl);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
