import crypto from 'crypto';

const STATIC_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA07s79gQJaSsYkCS6z0Tl
sqDY/H4VxUNRElsUs8YrZRd2bv4W8gD/kG7UVmBnJeQSlSF2o7nCy6aHhLaBk9vY
7k6vdQ+KUg7mIoChao8UOC/gLca9yRHHYt0JTF2JH736nt4BI2+IEefuHlC67A9M
EFNhWTKym2IKmmpqdfNCCmCCh/QorNbtUINvxVrQq/59s806/7zOgfmOQkKmGzYg
IjZN8sa8rg8BL4fGiVsOYKoYFBBWDFnFnAepE1eyUXA6GkVqd/GqKtjl0WFyPwVU
tHg1PmM+/5yOJlQJm3w/rIzDBkUmEhUDZpObakZHoH1jMr6es1Q57uM1HlHDRXLN
+QIDAQAB
-----END PUBLIC KEY-----`;

const STATIC_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDTuzv2BAlpKxiQ
JLrPROWyoNj8fhXFQ1ESWxSzxitlF3Zu/hbyAP+QbtRWYGcl5BKVIXajucLLpoeE
toGT29juTq91D4pSDuYigKFqjxQ4L+Atxr3JEcdi3QlMXYkfvfqe3gEjb4gR5+4e
ULrsD0wQU2FZMrKbYgqaamp180IKYIKH9Cis1u1Qg2/FWtCr/n2zzTr/vM6B+Y5C
QqYbNiAiNk3yxryuDwEvh8aJWw5gqhgUEFYMWcWcB6kTV7JRcDoaRWp38aoq2OXR
YXI/BVS0eDU+Yz7/nI4mVAmbfD+sjMMGRSYSFQNmk5tqRkegfWMyvp6zVDnu4zUe
UcNFcs35AgMBAAECggEAF7Y6x1j5YtVIOXBbmXXKUaBw3IoUTxS0Yh1gKqfxWS9w
/IopMK4K8PZwgkHmm1g4+omWW0yk86CxQZwc093FpB6cyLvWTk1L2aZVLXVbmtVF
wmqk+30purktXueEwVDJ3fvX3cuSTgsO4EdDP8eQya1E1DP4y60Fqfhr9syo4zdq
ivELK0yKTPTS5Z6Uhng2nj/m5Z7kiGz6dJGQAKiYxPruKWvWuJkZsDBwC8djwfMi
m1zUwur7Aduw/7wfmXgdw34+YkJolfg2azXbOTvkcbmZgI/m7A/1VGazeslfF4Cz
mrE2Gfp1fHvTgWbetWbEmU6igjS8nP7dMkWH9CdBAQKBgQDwGP+6w/0FXHkRQgH0
o8R17HKWnymv40rUNjpo0cUYDqGOBZYwK8ZsTK6fb+OUJ0n+4ZoGikeaeU5YLZum
boftG42lO9mMruhb/HN2unZE2sFp9CyOg/YFirm+P/EVboxtsqs4XtavExk4hdhl
JIprIZVIgAIIOuSFvrV87UDLuQKBgQDhwUSdMc/2PJYIahPYR+QwMC86p+k/9Cwk
HV3mz+82Kts4JREm8PaWM5K0cTEJV2Sl9FftDSDNnHb6zJ3qhUhZ+9/5Qf8B1ChV
HRqLLzQ6kvV7iBxxYwMbt9Y40cYUxzDLhTTshmu+fBE07iXIzZ7xk6fr+s6rO8hV
7+H06Um0QQKBgAxZjNXjfOFIt2V+2rDlt5ZFOkOrHi7Q5ylxPKHloFizb/XpLad+
qO8rJpRG4hLdzn2QxyZs+G/mq3P3rJjr+IvmreuA35jP6l3I53uE7c5u3iIAEEao
XQA9+X3ithjfHdQKq6nznuFUfyicIdxZ+9C04oPfKbuYo+aJP7aUUY/pAoGBAIHQ
NZlCjHfmTMuX28NxS3ieLHpJFWnuCPfXXyibBs2aBSaawesnglPKYiCaOf1KIJkB
ERJBi0xQHWaIBIJXk8wSdq8I0Q8HJQ4URzAju5+246veD6Tvr1jf9DIGBiXqiFdv
SIh9nzUQeIB8NIPsIOp+4n9iYDa8kK1B3CeNghFBAoGBAIOeiBzTRXKhN3OGBz8T
6LOlxzdHA4Wx8Izty/yXdGkfzEzPaTWuczkB7DE7ogZ+UJ/TmFKj5Z/rShQwYTLK
oa8sYqu2E30wpsqs0LxO0OnwDgmpWCpUZEZ6UxMg2NcdyzuKDdp7nZra0jMDhRmG
fDImHhPGLKQlW9HJSocfuj7P
-----END PRIVATE KEY-----`;

export const getAuthPublicKey = async () => {
  return process.env.AUTH_RSA_PUBLIC_KEY || STATIC_PUBLIC_KEY;
};

export const decryptAuthPayload = async (base64Ciphertext) => {
  const privateKey = process.env.AUTH_RSA_PRIVATE_KEY || STATIC_PRIVATE_KEY;
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
