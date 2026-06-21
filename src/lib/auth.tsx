import { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  work_start_time?: string;
  work_end_time?: string;
  shop?: {
    name?: string;
    status: string;
    expired_at: string;
    shop_code: string;
    custom_max_users?: number;
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
  const profileRef = useRef<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*, shops(name, status, expired_at, shop_code, custom_max_users, plans(id, name, max_users, max_staffs))')
        .eq('id', userId)
        .single();

      if (profErr) throw profErr;

      // Kiểm tra khung giờ làm việc
      if (prof.role !== 'super_admin' && prof.role !== 'shop_admin') {
        if (prof.work_start_time && prof.work_end_time) {
          const now = new Date();
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
          
          const start = prof.work_start_time.substring(0, 5); // Cắt lấy hh:mm
          const end = prof.work_end_time.substring(0, 5);

          let isAllowed = false;
          if (start <= end) {
            isAllowed = currentTimeStr >= start && currentTimeStr <= end;
          } else {
            // Ca đêm (vd 22:00 -> 06:00)
            isAllowed = currentTimeStr >= start || currentTimeStr <= end;
          }

          if (!isAllowed) {
            await supabase.auth.signOut();
            alert(`Bạn chỉ được phép truy cập trong khung giờ: ${start} → ${end}`);
            throw new Error('Ngoài thời gian làm việc');
          }
        }
      }

      const { data: perms } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId);

      const shopData = Array.isArray(prof.shops) ? prof.shops[0] : prof.shops;
      const planData = shopData?.plans ? (Array.isArray(shopData.plans) ? shopData.plans[0] : shopData.plans) : null;
      
      const newProfile = {
        ...prof,
        shop: shopData ? {
          ...shopData,
          plans: planData
        } : undefined,
        permissions: perms?.map(p => p.permission) || []
      };
      
      setProfile(newProfile);
      profileRef.current = newProfile as Profile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  useEffect(() => {
    const checkAutoLogout = () => {
      if (profileRef.current?.role === 'super_admin' || profileRef.current?.role === 'shop_admin') {
        return false;
      }

      const sessionDataStr = localStorage.getItem('daily_session');
      if (!sessionDataStr) return false;
      try {
        const sessionData = JSON.parse(sessionDataStr);
        const now = new Date();
        const todayStr = now.toLocaleDateString('vi-VN');
        
        // Sang ngày mới -> Đăng xuất
        if (sessionData.date !== todayStr) return true;
        
        // Đã đến 23h của cùng ngày -> Đăng xuất
        if (now.getHours() >= 23 && sessionData.hour < 23) return true;
      } catch (e) {
        return true;
      }
      return false;
    };

    const handleSessionInit = async (sessionUser: any) => {
      if (!sessionUser) {
        localStorage.removeItem('daily_session');
        setLoading(false);
        return;
      }

      if (checkAutoLogout()) {
        localStorage.removeItem('daily_session');
        await supabase.auth.signOut();
        alert('Hệ thống tự động đăng xuất lúc 23:00 hoặc khi qua ngày mới. Vui lòng đăng nhập lại!');
        return;
      }

      // Initialize session if missing
      if (!localStorage.getItem('daily_session')) {
        const now = new Date();
        localStorage.setItem('daily_session', JSON.stringify({
          date: now.toLocaleDateString('vi-VN'),
          hour: now.getHours()
        }));
      }
      
      fetchProfile(sessionUser.id).finally(() => setLoading(false));
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      handleSessionInit(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        if (checkAutoLogout()) {
          localStorage.removeItem('daily_session');
          await supabase.auth.signOut();
          return;
        }

        if (!localStorage.getItem('daily_session')) {
          const now = new Date();
          localStorage.setItem('daily_session', JSON.stringify({
            date: now.toLocaleDateString('vi-VN'),
            hour: now.getHours()
          }));
        }
        fetchProfile(sessionUser.id);
      } else {
        localStorage.removeItem('daily_session');
        setProfile(null);
        setLoading(false);
      }
    });

    // Kiểm tra định kỳ mỗi 1 phút để tự động đăng xuất
    const interval = setInterval(async () => {
      if (checkAutoLogout()) {
        localStorage.removeItem('daily_session');
        await supabase.auth.signOut();
        alert('Hệ thống tự động đăng xuất lúc 23:00. Vui lòng đăng nhập lại!');
        window.location.href = '/login';
      }
    }, 60000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
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
