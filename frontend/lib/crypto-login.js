/**
 * Client-side RSA-OAEP credentials encryption using native Web Crypto API.
 * Encrypts email & password before sending over network, so credentials
 * never appear in plain text in DevTools Network tab or memory dumps.
 */

const STATIC_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA07s79gQJaSsYkCS6z0Tl
sqDY/H4VxUNRElsUs8YrZRd2bv4W8gD/kG7UVmBnJeQSlSF2o7nCy6aHhLaBk9vY
7k6vdQ+KUg7mIoChao8UOC/gLca9yRHHYt0JTF2JH736nt4BI2+IEefuHlC67A9M
EFNhWTKym2IKmmpqdfNCCmCCh/QorNbtUINvxVrQq/59s806/7zOgfmOQkKmGzYg
IjZN8sa8rg8BL4fGiVsOYKoYFBBWDFnFnAepE1eyUXA6GkVqd/GqKtjl0WFyPwVU
tHg1PmM+/5yOJlQJm3w/rIzDBkUmEhUDZpObakZHoH1jMr6es1Q57uM1HlHDRXLN
+QIDAQAB
-----END PUBLIC KEY-----`;

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
      const pemContents = STATIC_PUBLIC_KEY_PEM
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
      email: String(email || '').trim().toLowerCase(),
      password: String(password || ''),
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
    console.warn('Client-side login encryption error:', err);
    return null;
  }
}
