/**
 * Client-side RSA-OAEP credentials encryption using native Web Crypto API.
 * Encrypts email & password before sending over network, so credentials
 * never appear in plain text in DevTools Network tab or memory dumps.
 */

let cachedPublicKeyPem = null;
let cachedCryptoKey = null;

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function encryptLoginPayload(email, password) {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return null;
  }

  try {
    if (!cachedCryptoKey) {
      const res = await fetch('/api/v1/auth/public-key');
      const json = await res.json();
      if (!json.success || !json.publicKey) {
        throw new Error('Failed to fetch public key');
      }

      cachedPublicKeyPem = json.publicKey;

      const pemContents = cachedPublicKeyPem
        .replace(/-----BEGIN PUBLIC KEY-----/g, '')
        .replace(/-----END PUBLIC KEY-----/g, '')
        .replace(/\s+/g, '');

      const binaryDer = base64ToArrayBuffer(pemContents);

      cachedCryptoKey = await window.crypto.subtle.importKey(
        'spki',
        binaryDer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false,
        ['encrypt']
      );
    }

    const payload = JSON.stringify({
      email,
      password,
      timestamp: Date.now(),
    });

    const encoded = new TextEncoder().encode(payload);
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      cachedCryptoKey,
      encoded
    );

    return arrayBufferToBase64(cipherBuffer);
  } catch (err) {
    console.warn('Client-side login encryption warning (falling back):', err);
    return null;
  }
}
