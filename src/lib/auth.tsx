import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabase';

interface Profile {
  id: string;
  shop_id: string;
  username: string;
  full_name: string;
  role: 'super_admin' | 'shop_admin' | 'staff';
  status: string;
  permissions: string[];
  shop?: {
    name?: string;
    status: string;
    expired_at: string;
    shop_code: string;
    plans?: {
      id: string;
      name: string;
      max_users: number;
      max_staffs: number;
    };
  };
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  isRestricted: () => boolean;
  shopStatus: { status: string; daysLeft: number | null };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  hasPermission: () => false,
  isRestricted: () => false,
  shopStatus: { status: 'active', daysLeft: null }
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*, shops(name, status, expired_at, shop_code, plans(id, name, max_users, max_staffs))')
        .eq('id', userId)
        .single();

      if (profErr) throw profErr;

      const { data: perms } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId);

      const shopData = Array.isArray(prof.shops) ? prof.shops[0] : prof.shops;
      const planData = shopData?.plans ? (Array.isArray(shopData.plans) ? shopData.plans[0] : shopData.plans) : null;
      
      setProfile({
        ...prof,
        shop: shopData ? {
          ...shopData,
          plans: planData
        } : undefined,
        permissions: perms?.map(p => p.permission) || []
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const hasPermission = (perm: string) => {
    if (profile?.role === 'super_admin' || profile?.role === 'shop_admin') return true; 
    return profile?.permissions?.includes(perm) || false;
  };

  const isRestricted = () => {
    if (profile?.role === 'super_admin') return false;
    const status = profile?.shop?.status;
    return status === 'expired' || status === 'locked';
  };

  const getShopStatusInfo = () => {
    if (!profile?.shop) return { status: 'active', daysLeft: null };
    const status = profile.shop.status;
    let daysLeft = null;
    if (profile.shop.expired_at) {
      const diff = new Date(profile.shop.expired_at).getTime() - new Date().getTime();
      daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
    return { status, daysLeft };
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signOut, 
      hasPermission, 
      isRestricted,
      shopStatus: getShopStatusInfo()
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export const ProtectedRoute = ({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Đang tải...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) return <Navigate to="/app/pos" replace />;

  return <>{children}</>;
};
