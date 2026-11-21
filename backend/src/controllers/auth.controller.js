import * as authService from '../services/auth.service.js';
import { getAuthPublicKey, decryptAuthPayload } from '../utils/crypto-auth.js';

export const getPublicKey = async (req, res, next) => {
  try {
    const publicKey = await getAuthPublicKey();
    res.json({ success: true, publicKey });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    let { email, password, encryptedPayload } = req.body;

    if (encryptedPayload) {
      try {
        const decrypted = await decryptAuthPayload(encryptedPayload);
        email = decrypted.email;
        password = decrypted.password;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired encrypted credentials',
        });
      }
    }

    const data = await authService.loginUser(email, password);

    res.json({
      success: true,
      message: 'Logged in successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.user.id);
    res.json({
      success: true,
      message: 'User profile fetched successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};
