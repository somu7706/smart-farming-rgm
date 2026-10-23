import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { api, getAuthToken, setAuthToken } from "@/lib/api";

export type AppRole = "farmer" | "consumer";

export interface AppUser {
  id: string; // Compatible with Supabase UUID & MongoDB
  mongoId?: string;
  supabaseId?: string;
  email: string;
  role: AppRole;
  fullName?: string;
  region?: string;
  phone?: string;
  isEmailVerified?: boolean;
  user_metadata?: Record<string, any>;
}

interface AuthContextType {
  user: AppUser | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  login: (credentials: { email: string; password: string }) => Promise<any>;
  register: (data: any) => Promise<any>;
  resendVerification: (email: string) => Promise<any>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
  login: async () => {},
  register: async () => {},
  resendVerification: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Synchronize or bridge Supabase session silently in background for orders/realtime compatibility
  const syncSupabaseSession = async (email: string, password?: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session && password) {
        // Try sign in to Supabase shadow user
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          // If doesn't exist, sign up to Supabase
          await supabase.auth.signUp({
            email,
            password,
            options: { data: { email } },
          });
        }
      }
    } catch (e) {
      console.warn("[Auth Bridge] Supabase sync notice:", e);
    }
  };

  const fetchCurrentUser = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get<{ user: any; profile: any }>("/auth/me");
      if (res && res.user) {
        const userData: AppUser = {
          id: res.user.id || res.user.supabaseId || res.user.mongoId,
          mongoId: res.user.mongoId,
          supabaseId: res.user.supabaseId,
          email: res.user.email,
          role: res.user.role as AppRole,
          fullName: res.profile?.fullName || "",
          region: res.profile?.region || "",
          phone: res.profile?.phone || "",
          isEmailVerified: res.user.isEmailVerified,
          user_metadata: {
            full_name: res.profile?.fullName || "",
            role: res.user.role,
          },
        };

        setUser(userData);
        setRole(userData.role);
      } else {
        setAuthToken(null);
        setUser(null);
        setRole(null);
      }
    } catch (error) {
      console.error("[Auth] Session validation failed:", error);
      setAuthToken(null);
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async ({ email, password }: { email: string; password: string }) => {
    const res = await api.post("/auth/login", { email, password });
    if (res.token) {
      setAuthToken(res.token);

      const userData: AppUser = {
        id: res.user.id,
        mongoId: res.user.mongoId,
        supabaseId: res.user.supabaseId,
        email: res.user.email,
        role: res.user.role as AppRole,
        fullName: res.user.fullName || "",
        region: res.user.region || "",
        phone: res.user.phone || "",
        isEmailVerified: res.user.isEmailVerified,
        user_metadata: {
          full_name: res.user.fullName,
          role: res.user.role,
        },
      };

      setUser(userData);
      setRole(userData.role);

      // Silent Supabase shadow sync for order RLS compatibility
      syncSupabaseSession(email, password);
    }
    return res;
  };

  const register = async (formData: any) => {
    const res = await api.post("/auth/register", formData);
    return res;
  };

  const resendVerification = async (email: string) => {
    const res = await api.post("/auth/resend-verification", { email });
    return res;
  };

  const signOut = async () => {
    setAuthToken(null);
    setUser(null);
    setRole(null);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Ignore Supabase signout error
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        signOut,
        login,
        register,
        resendVerification,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
