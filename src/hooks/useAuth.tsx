import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AdminData {
  id: string;
  user_id: string;
  division_id: string;
  full_name?: string | null;
  access_all_divisions?: boolean;
  additional_division_ids?: string[];
  is_read_only?: boolean;
  cash_collection_enabled?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  isLoading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isMember: boolean;
  adminToken: string | null;
  adminData: AdminData | null;
  isReadOnly: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInAsAdmin: (token: string, admin: AdminData) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_TOKEN_KEY = "elife_admin_token";
const ADMIN_DATA_KEY = "elife_admin_data";

function getStoredAdminSession(): { token: string; data: AdminData } | null {
  try {
    const storedToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    const storedAdminData = localStorage.getItem(ADMIN_DATA_KEY);
    if (!storedToken || !storedAdminData) return null;

    const [payload] = storedToken.split(".");
    const decoded = JSON.parse(atob(payload));

    if (decoded.exp && decoded.exp > Date.now()) {
      return { token: storedToken, data: JSON.parse(storedAdminData) };
    }

    // Token expired, clear it
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_DATA_KEY);
    return null;
  } catch {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_DATA_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const storedAdmin = getStoredAdminSession();
  const [roles, setRoles] = useState<AppRole[]>(storedAdmin ? ["admin"] : []);
  const [isLoading, setIsLoading] = useState(true);
  const [adminToken, setAdminToken] = useState<string | null>(storedAdmin?.token ?? null);
  const [adminData, setAdminData] = useState<AdminData | null>(storedAdmin?.data ?? null);

  const fetchUserRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching roles:", error);
      return [];
    }

    return data?.map((r) => r.role) || [];
  };

  useEffect(() => {
    const refreshAdminData = async () => {
      if (!adminToken) return;
      
      try {
        const { data, error } = await supabase.functions.invoke("admin-auth", {
          body: { action: "refresh" },
          headers: { "x-admin-token": adminToken },
        });

        if (!error && data?.success && data?.admin) {
          const updatedAdmin: AdminData = {
            id: data.admin.id,
            user_id: data.admin.user_id,
            division_id: data.admin.division_id,
            full_name: data.admin.full_name,
            access_all_divisions: data.admin.access_all_divisions,
            additional_division_ids: data.admin.additional_division_ids,
            is_read_only: data.admin.is_read_only,
          };
          setAdminData(updatedAdmin);
          localStorage.setItem(ADMIN_DATA_KEY, JSON.stringify(updatedAdmin));
        }
      } catch (err) {
        console.error("Error refreshing admin data:", err);
      }
    };

    refreshAdminData();
  }, [adminToken]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role fetching with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserRoles(session.user.id).then(setRoles);
          }, 0);
        } else if (!adminToken) {
          setRoles([]);
        }
        
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRoles(session.user.id).then(setRoles);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [adminToken]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signInAsAdmin = (token: string, admin: AdminData) => {
    setAdminToken(token);
    setAdminData(admin);
    setRoles(["admin"]);
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_DATA_KEY, JSON.stringify(admin));
  };

  const signOut = async () => {
    // Clear admin session
    if (adminToken) {
      setAdminToken(null);
      setAdminData(null);
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      localStorage.removeItem(ADMIN_DATA_KEY);
    }
    
    // Clear Supabase session
    await supabase.auth.signOut();
    setRoles([]);
  };

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = roles.includes("admin") || isSuperAdmin;
  const isMember = roles.includes("member") || isAdmin;
  const isReadOnly = adminData?.is_read_only ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        isLoading,
        isSuperAdmin,
        isAdmin,
        isMember,
        adminToken,
        adminData,
        isReadOnly,
        signIn,
        signInAsAdmin,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
