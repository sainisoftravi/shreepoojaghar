import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';

const prisma = new PrismaClient();
let cachedKeyPair = null;

export const getOrInitAuthKeyPair = async () => {
  if (cachedKeyPair) return cachedKeyPair;

  try {
    const setting = await prisma.shopSetting.findUnique({
      where: { key: 'auth_rsa_keypair' },
    });

    if (setting?.value) {
      cachedKeyPair = JSON.parse(setting.value);
      return cachedKeyPair;
    }
  } catch (err) {
    logger.warn({ err: err?.message }, 'Failed to read auth RSA key pair from database, will generate fallback');
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  cachedKeyPair = { publicKey, privateKey };

  try {
    await prisma.shopSetting.upsert({
      where: { key: 'auth_rsa_keypair' },
      update: { value: JSON.stringify(cachedKeyPair) },
      create: { key: 'auth_rsa_keypair', value: JSON.stringify(cachedKeyPair) },
    });
  } catch (err) {
    logger.warn({ err: err?.message }, 'Could not persist auth RSA key pair to database');
  }

  return cachedKeyPair;
};

export const getAuthPublicKey = async () => {
  const pair = await getOrInitAuthKeyPair();
  return pair.publicKey;
};

export const decryptAuthPayload = async (base64Ciphertext) => {
  const { privateKey } = await getOrInitAuthKeyPair();
  const buffer = Buffer.from(base64Ciphertext, 'base64');
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    buffer
  );
  return JSON.parse(decrypted.toString('utf8'));
};
