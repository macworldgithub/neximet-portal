'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiGet, apiPost, getToken, setToken, removeToken } from '../lib/api';

export type UserRole = 'CEO' | 'Super Admin' | 'Project Manager' | 'Team Manager' | 'Team Member';
export type Department =
  | 'Executive'
  | 'Software Development'
  | 'Digital Marketing (SEO)'
  | 'Graphics Designing'
  | 'WordPress Team';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: Department;
  designation: string;
  baseSalary?: number;
  dailyWage?: number;
  phone?: string;
  leaveBalances?: {
    casual: number;
    sick: number;
    annual: number;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const existingToken = getToken();
    if (!existingToken) {
      setUser(null);
      setTokenState(null);
      setLoading(false);
      return;
    }

    try {
      const res = await apiGet('/auth/me');
      if (res.success && res.user) {
        setUser(res.user);
        setTokenState(existingToken);
      } else {
        removeToken();
        setUser(null);
        setTokenState(null);
      }
    } catch {
      removeToken();
      setUser(null);
      setTokenState(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const existingToken = getToken();
      if (existingToken) {
        await refreshUser();
      } else {
        setUser(null);
        setTokenState(null);
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await apiPost('/auth/login', { email, password });
      if (res.success && res.token && res.user) {
        setToken(res.token);
        setTokenState(res.token);
        setUser(res.user);
        setLoading(false);
        return { success: true };
      }
      setLoading(false);
      return { success: false, message: res.message || 'Invalid email or password' };
    } catch (err: any) {
      setLoading(false);
      return { success: false, message: err?.message || 'Login request failed' };
    }
  };

  const logout = () => {
    removeToken();
    setUser(null);
    setTokenState(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const hasRole = (...roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const isSuperAdmin = user?.role === 'CEO' || user?.role === 'Super Admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isSuperAdmin,
        login,
        logout,
        refreshUser,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
