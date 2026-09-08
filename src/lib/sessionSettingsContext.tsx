import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface SessionStaff {
  id: string;
  full_name: string;
  phone: string;
  position: string;
  status: string;
}

export interface SessionPlace {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface SessionService {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  status: string;
}

export interface SessionInvoice {
  id: string;
  invoice_code: string;
  customer_name: string;
  service_name: string;
  amount: number;
  created_at: string;
}

interface SessionSettingsContextType {
  staffList: SessionStaff[];
  placeList: SessionPlace[];
  serviceList: SessionService[];
  invoiceList: SessionInvoice[];
  addStaff: (staff: Omit<SessionStaff, 'id'>) => void;
  updateStaff: (id: string, staff: Partial<SessionStaff>) => void;
  deleteStaff: (id: string) => void;
  addPlace: (place: Omit<SessionPlace, 'id'>) => void;
  updatePlace: (id: string, place: Partial<SessionPlace>) => void;
  deletePlace: (id: string) => void;
  addService: (service: Omit<SessionService, 'id'>) => void;
  updateService: (id: string, service: Partial<SessionService>) => void;
  deleteService: (id: string) => void;
  addInvoice: (invoice: Omit<SessionInvoice, 'id' | 'created_at'>) => void;
  deleteInvoices: (ids: string[]) => void;
  clearAllSessionData: () => void;
}

const SessionSettingsContext = createContext<SessionSettingsContextType | null>(null);

// Key cache cục bộ lưu trữ trong trình duyệt cho riêng phiên làm việc của user q_lady
// Giúp bảo toàn dữ liệu khi F5/reload hoặc chuyển tab
// Tuyệt đối không gửi lên database Supabase
const SESSION_CACHE_KEY = 'posspa_session_settings_cache_qlady';

const loadCache = () => {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Không thể đọc session settings cache:', e);
  }
  return null;
};

const saveCache = (data: {
  staffList: SessionStaff[];
  placeList: SessionPlace[];
  serviceList: SessionService[];
  invoiceList: SessionInvoice[];
}) => {
  try {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Không thể lưu session settings cache:', e);
  }
};

export const SessionSettingsProvider = ({ children }: { children: ReactNode }) => {
  const cached = loadCache();
  const [staffList, setStaffList] = useState<SessionStaff[]>(cached?.staffList || []);
  const [placeList, setPlaceList] = useState<SessionPlace[]>(cached?.placeList || []);
  const [serviceList, setServiceList] = useState<SessionService[]>(cached?.serviceList || []);
  const [invoiceList, setInvoiceList] = useState<SessionInvoice[]>(cached?.invoiceList || []);

  // Tự động đồng bộ cache khi có thay đổi để F5 hoặc chuyển tab không bị mất dữ liệu
  useEffect(() => {
    saveCache({ staffList, placeList, serviceList, invoiceList });
  }, [staffList, placeList, serviceList, invoiceList]);

  // Nhân viên CRUD
  const addStaff = (item: Omit<SessionStaff, 'id'>) => {
    const newItem: SessionStaff = {
      ...item,
      id: `stf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    };
    setStaffList(prev => [newItem, ...prev]);
  };

  const updateStaff = (id: string, item: Partial<SessionStaff>) => {
    setStaffList(prev => prev.map(s => s.id === id ? { ...s, ...item } : s));
  };

  const deleteStaff = (id: string) => {
    setStaffList(prev => prev.filter(s => s.id !== id));
  };

  // Chỗ CRUD
  const addPlace = (item: Omit<SessionPlace, 'id'>) => {
    const newItem: SessionPlace = {
      ...item,
      id: `plc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    };
    setPlaceList(prev => [newItem, ...prev]);
  };

  const updatePlace = (id: string, item: Partial<SessionPlace>) => {
    setPlaceList(prev => prev.map(p => p.id === id ? { ...p, ...item } : p));
  };

  const deletePlace = (id: string) => {
    setPlaceList(prev => prev.filter(p => p.id !== id));
  };

  // Dịch vụ CRUD
  const addService = (item: Omit<SessionService, 'id'>) => {
    const newItem: SessionService = {
      ...item,
      id: `svc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    };
    setServiceList(prev => [newItem, ...prev]);
  };

  const updateService = (id: string, item: Partial<SessionService>) => {
    setServiceList(prev => prev.map(s => s.id === id ? { ...s, ...item } : s));
  };

  const deleteService = (id: string) => {
    setServiceList(prev => prev.filter(s => s.id !== id));
  };

  // Hóa đơn CRUD
  const addInvoice = (item: Omit<SessionInvoice, 'id' | 'created_at'>) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    const newItem: SessionInvoice = {
      ...item,
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      created_at: timeStr
    };
    setInvoiceList(prev => [newItem, ...prev]);
  };

  const deleteInvoices = (ids: string[]) => {
    const idSet = new Set(ids);
    setInvoiceList(prev => prev.filter(inv => !idSet.has(inv.id)));
  };

  // Cơ chế xóa duy nhất: Nhấp ⚙️ 3 lần liên tiếp trong khoảng 1,5 giây
  const clearAllSessionData = () => {
    setStaffList([]);
    setPlaceList([]);
    setServiceList([]);
    setInvoiceList([]);
    try {
      localStorage.removeItem(SESSION_CACHE_KEY);
    } catch (e) {
      console.warn('Không thể xóa session settings cache:', e);
    }
  };

  return (
    <SessionSettingsContext.Provider
      value={{
        staffList,
        placeList,
        serviceList,
        invoiceList,
        addStaff,
        updateStaff,
        deleteStaff,
        addPlace,
        updatePlace,
        deletePlace,
        addService,
        updateService,
        deleteService,
        addInvoice,
        deleteInvoices,
        clearAllSessionData
      }}
    >
      {children}
    </SessionSettingsContext.Provider>
  );
};

export const useSessionSettings = () => {
  const context = useContext(SessionSettingsContext);
  if (!context) {
    throw new Error('useSessionSettings must be used within a SessionSettingsProvider');
  }
  return context;
};
