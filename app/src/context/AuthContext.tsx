import React, { createContext, useCallback, useEffect, useMemo, useState, useContext, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { OwnerRecord } from '../types/auth';

interface AuthContextType {
  token: string | null;
  owner: OwnerRecord | null;
  isHydrating: boolean;
  login: (token: string, owner: OwnerRecord) => Promise<void>;
  updateOwner: (owner: OwnerRecord) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_SESSION_KEY = 'qr-project-auth-session';

interface PersistedSession {
  token: string;
  owner: OwnerRecord;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const rawSession = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
        if (!mounted || !rawSession) {
          return;
        }

        const session = JSON.parse(rawSession) as PersistedSession;
        if (!session.token || !session.owner) {
          await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
          return;
        }

        setToken(session.token);
        setOwner(session.owner);
      } catch {
        await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
      } finally {
        if (mounted) {
          setIsHydrating(false);
        }
      }
    }

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (newToken: string, newOwner: OwnerRecord) => {
    setToken(newToken);
    setOwner(newOwner);
    const session: PersistedSession = {
      token: newToken,
      owner: newOwner,
    };
    await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
  }, []);

  const updateOwner = useCallback(async (nextOwner: OwnerRecord) => {
    setOwner(nextOwner);

    if (token) {
      const session: PersistedSession = {
        token,
        owner: nextOwner,
      };
      await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
    }
  }, [token]);

  const logout = useCallback(async () => {
    setToken(null);
    setOwner(null);
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
  }, []);

  const value = useMemo(
    () => ({ token, owner, isHydrating, login, updateOwner, logout }),
    [token, owner, isHydrating, login, updateOwner, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
