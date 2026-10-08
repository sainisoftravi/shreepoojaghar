import {
  requestPairingCode,
  getWhatsAppStatus,
  logoutWhatsApp,
} from '../services/whatsapp.service.js';

export const getStatus = (req, res) => {
  const statusInfo = getWhatsAppStatus();
  res.json({ success: true, ...statusInfo });
};

export const pairPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    const code = await requestPairingCode(phone);
    res.json({ success: true, code });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to request pairing code' });
  }
};

export const logout = async (req, res) => {
  try {
    await logoutWhatsApp();
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to logout' });
  }
};
