'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiFetch } from '../lib/api.js';
import { encryptLoginPayload } from '../lib/crypto-login.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const token = localStorage.getItem('token');
    if (!token || token === 'undefined' || token === 'null') {
      localStorage.removeItem('token');
      setLoading(false);
      if (pathname !== '/login') router.push('/login');
      return;
    }

    try {
      const res = await apiFetch('/auth/me');
      setUser(res.data?.user || res.data);
    } catch (err) {
      console.error('Auth check failed:', err);
      localStorage.removeItem('token');
      if (pathname !== '/login') router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    let bodyObj = { email, password };

    try {
      const encryptedPayload = await encryptLoginPayload(email, password);
      if (encryptedPayload) {
        bodyObj = { encryptedPayload };
      }
    } catch (_) {}

    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(bodyObj),
    });

    const token = res.data?.token;
    const userData = res.data?.user;

    if (token) {
      localStorage.setItem('token', token);
      setUser(userData);
      router.push('/pos');
    } else {
      throw new Error('Token not received from server');
    }

    return res;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
