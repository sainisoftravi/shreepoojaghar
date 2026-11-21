import {
  requestPairingCode,
  getWhatsAppStatus,
  logoutWhatsApp,
  refreshWhatsAppQR,
} from '../services/whatsapp.service.js';
import { whatsappQueue } from '../jobs/whatsapp.queue.js';

export const getStatus = (req, res) => {
  const statusInfo = getWhatsAppStatus();
  res.json({ success: true, ...statusInfo });
};

export const refreshQr = async (req, res) => {
  try {
    const result = await refreshWhatsAppQR();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to refresh QR code' });
  }
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

export const broadcastProduct = async (req, res) => {
  try {
    const { productId, type } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required for broadcast' });
    }

    await whatsappQueue.add('product-broadcast', {
      productId,
      type: type || 'NEW_PRODUCT',
      broadcastType: 'PRODUCT_ARRIVAL',
    });

    res.json({
      success: true,
      message: 'Product broadcast successfully queued. Messages will be sent in the background.',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to queue broadcast' });
  }
};
