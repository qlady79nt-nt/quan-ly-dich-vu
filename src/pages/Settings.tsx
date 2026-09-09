import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, 
  LayoutGrid, 
  Scissors, 
  FileText, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  CheckSquare, 
  Square,
  Search,
  User,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { 
  useSessionSettings, 
  type SessionStaff, 
  type SessionPlace, 
  type SessionService
} from '../lib/sessionSettingsContext';

const Settings = () => {
  const {
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
    deleteInvoices
  } = useSessionSettings();

  const { profile } = useAuth();
  const shopId = profile?.shop_id;

  const [realStaff, setRealStaff] = useState<any[]>([]);
  const [loadingRealStaff, setLoadingRealStaff] = useState(false);

  useEffect(() => {
    if (shopId) {
      fetchRealStaff();
    }
  }, [shopId]);

  const fetchRealStaff = async () => {
    setLoadingRealStaff(true);
    const { data, error } = await supabase
      .from('staffs')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: true });
    if (!error && data) {
      setRealStaff(data);
    }
    setLoadingRealStaff(false);
  };

  const [activeTab, setActiveTab] = useState<'staff' | 'place' | 'service' | 'invoice'>('staff');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({
    full_name: '',
    phone: '',
    position: 'KTV',
    status: 'Đang làm'
  });

  const [placeModalOpen, setPlaceModalOpen] = useState(false);
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [placeForm, setPlaceForm] = useState({
    name: '',
    type: 'Giường',
    status: 'Hoạt động'
  });

  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    price: 150000,
    duration_minutes: 60,
    status: 'Đang phục vụ'
  });

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_code: '',
    customer_name: 'Nguyễn Văn A',
    service_name: '',
    amount: 150000
  });

  // --- Helpers ---
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const generateDefaultInvoiceCode = () => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const rand4 = Math.floor(1000 + Math.random() * 9000);
    return `#HD${dd}${mm}${rand4}`;
  };

  // --- Handlers: Staff ---
  const handleOpenStaffModal = (staff?: SessionStaff) => {
    if (staff) {
      setEditingStaffId(staff.id);
      setStaffForm({
        full_name: staff.full_name,
        phone: staff.phone,
        position: staff.position || 'KTV',
        status: staff.status
      });
    } else {
      setEditingStaffId(null);
      setStaffForm({
        full_name: '',
        phone: '',
        position: 'KTV',
        status: 'Đang làm'
      });
    }
    setStaffModalOpen(true);
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.full_name.trim()) return;
    const staffData = { ...staffForm, position: 'KTV' };
    if (editingStaffId) {
      updateStaff(editingStaffId, staffData);
    } else {
      addStaff(staffData);
    }
    setStaffModalOpen(false);
  };

  // --- Handlers: Place ---
  const handleOpenPlaceModal = (place?: SessionPlace) => {
    if (place) {
      setEditingPlaceId(place.id);
      setPlaceForm({
        name: place.name,
        type: place.type,
        status: place.status
      });
    } else {
      setEditingPlaceId(null);
      setPlaceForm({
        name: '',
        type: 'Giường',
        status: 'Hoạt động'
      });
    }
    setPlaceModalOpen(true);
  };

  const handleSavePlace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeForm.name.trim()) return;
    if (editingPlaceId) {
      updatePlace(editingPlaceId, placeForm);
    } else {
      addPlace(placeForm);
    }
    setPlaceModalOpen(false);
  };

  // --- Handlers: Service ---
  const handleOpenServiceModal = (service?: SessionService) => {
    if (service) {
      setEditingServiceId(service.id);
      setServiceForm({
        name: service.name,
        price: service.price,
        duration_minutes: service.duration_minutes,
        status: service.status
      });
    } else {
      setEditingServiceId(null);
      setServiceForm({
        name: '',
        price: 150000,
        duration_minutes: 60,
        status: 'Đang phục vụ'
      });
    }
    setServiceModalOpen(true);
  };

  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.name.trim()) return;
    if (editingServiceId) {
      updateService(editingServiceId, serviceForm);
    } else {
      addService(serviceForm);
    }
    setServiceModalOpen(false);
  };

  // --- Handlers: Invoice ---
  const handleOpenInvoiceModal = () => {
    const defaultSvc = serviceList.length > 0 ? serviceList[0].name : 'Gội đầu dưỡng sinh';
    const defaultPrice = serviceList.length > 0 ? serviceList[0].price : 150000;
    setInvoiceForm({
      invoice_code: generateDefaultInvoiceCode(),
      customer_name: 'Khách lẻ',
      service_name: defaultSvc,
      amount: defaultPrice
    });
    setInvoiceModalOpen(true);
  };

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.invoice_code.trim()) return;
    addInvoice(invoiceForm);
    setInvoiceModalOpen(false);
  };

  const handleToggleSelectInvoice = (id: string) => {
    setSelectedInvoiceIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllInvoices = () => {
    if (selectedInvoiceIds.length === invoiceList.length && invoiceList.length > 0) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(invoiceList.map(i => i.id));
    }
  };

  const handleDeleteSelectedInvoices = () => {
    if (selectedInvoiceIds.length === 0) return;
    deleteInvoices(selectedInvoiceIds);
    setSelectedInvoiceIds([]);
  };

  const isKtvPosition = (pos: string) => {
    if (!pos) return false;
    const p = pos.trim().toLowerCase();
    return p === 'technician' || p === 'ktv';
  };

  const isStaffActive = (s: { status?: string | null; is_active?: boolean; deleted_at?: string | null }) => {
    if (!s) return false;
    if (s.deleted_at) return false;
    if (s.is_active === false) return false;
    if (s.status) {
      const st = s.status.trim().toLowerCase();
      if (
        st === 'inactive' ||
        st === 'nghỉ làm' ||
        st === 'nghi lam' ||
        st === 'nghỉ việc' ||
        st === 'nghi viec'
      ) {
        return false;
      }
    }
    return true;
  };

  const getStaffPositionLabel = (_pos: string) => {
    return 'KTV';
  };

  // --- Filtering (Chỉ hiển thị nhân viên KTV đang làm việc) ---
  const filteredRealStaff = realStaff
    .filter(s => isKtvPosition(s.position) && isStaffActive(s))
    .filter(s =>
      (s.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.phone || '').includes(searchTerm)
    );

  const filteredSessionStaff = staffList
    .filter(s => isKtvPosition(s.position) && isStaffActive(s))
    .filter(s =>
      (s.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.phone || '').includes(searchTerm)
    );

  const totalKtvCount = realStaff.filter(s => isKtvPosition(s.position) && isStaffActive(s)).length + staffList.filter(s => isKtvPosition(s.position) && isStaffActive(s)).length;

  const filteredPlaces = placeList.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredServices = serviceList.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredInvoices = invoiceList.filter(i => 
    i.invoice_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.service_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Cài đặt</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: 0 }}>
            Quản lý thông tin và cấu hình hệ thống
          </p>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem', gap: '0.25rem' }}>
          <button
            onClick={() => { setActiveTab('staff'); setSearchTerm(''); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              background: activeTab === 'staff' ? 'white' : 'transparent',
              color: activeTab === 'staff' ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'staff' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            <Users size={16} />
            Nhân viên ({totalKtvCount})
          </button>

          <button
            onClick={() => { setActiveTab('place'); setSearchTerm(''); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              background: activeTab === 'place' ? 'white' : 'transparent',
              color: activeTab === 'place' ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'place' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            <LayoutGrid size={16} />
            Chỗ ({placeList.length})
          </button>

          <button
            onClick={() => { setActiveTab('service'); setSearchTerm(''); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              background: activeTab === 'service' ? 'white' : 'transparent',
              color: activeTab === 'service' ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'service' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            <Scissors size={16} />
            Dịch vụ ({serviceList.length})
          </button>

          {/* Tab Hóa đơn được ẩn theo yêu cầu */}
          <button
            onClick={() => { setActiveTab('invoice'); setSearchTerm(''); }}
            style={{
              display: 'none',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              background: activeTab === 'invoice' ? 'white' : 'transparent',
              color: activeTab === 'invoice' ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'invoice' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            <FileText size={16} />
            Hóa đơn ({invoiceList.length})
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* Sub-header Actions */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input
              type="text"
              placeholder="Tìm kiếm nhanh..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>

          <div>
            {activeTab === 'staff' && (
              <button
                onClick={() => handleOpenStaffModal()}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                <Plus size={16} />
                Thêm nhân viên
              </button>
            )}

            {activeTab === 'place' && (
              <button
                onClick={() => handleOpenPlaceModal()}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                <Plus size={16} />
                Thêm chỗ
              </button>
            )}

            {activeTab === 'service' && (
              <button
                onClick={() => handleOpenServiceModal()}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                <Plus size={16} />
                Thêm dịch vụ
              </button>
            )}

            {activeTab === 'invoice' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {selectedInvoiceIds.length > 0 && (
                  <button
                    onClick={handleDeleteSelectedInvoices}
                    className="btn"
                    style={{
                      background: 'var(--danger)',
                      color: 'white',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    <Trash2 size={16} />
                    Xóa ({selectedInvoiceIds.length})
                  </button>
                )}
                <button
                  onClick={handleOpenInvoiceModal}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  <Plus size={16} />
                  Tạo hóa đơn
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Staff Cards */}
        {activeTab === 'staff' && (
          <div style={{ padding: '1.5rem' }}>
            {loadingRealStaff ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                <Loader2 className="animate-spin" size={24} style={{ display: 'inline', marginRight: '0.5rem' }} />
                Đang tải...
              </div>
            ) : filteredRealStaff.length === 0 && filteredSessionStaff.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                Chưa có nhân viên nào trong danh sách
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: '1rem'
              }}>
                {/* 1. Nhân viên thật hiện tại của shop */}
                {filteredRealStaff.map(item => (
                  <div
                    key={`real_staff_${item.id}`}
                    className="premium-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      padding: '1.25rem 1rem',
                      borderRadius: '0.75rem',
                      border: '1px solid var(--border)',
                      background: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: 'rgba(109, 40, 217, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                      marginBottom: '0.75rem'
                    }}>
                      <User size={26} />
                    </div>
                    <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)', wordBreak: 'break-word', lineHeight: '1.3' }}>
                      {item.full_name}
                    </h4>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      {getStaffPositionLabel(item.position)}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          // Nhân viên thật: Sửa không có tác vụ
                          e.stopPropagation();
                        }}
                        className="btn"
                        style={{
                          flex: 1,
                          padding: '0.4rem',
                          fontSize: '0.8rem',
                          background: 'transparent',
                          color: 'var(--primary)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          // Nhân viên thật: Xóa không có tác vụ
                          e.stopPropagation();
                        }}
                        className="btn"
                        style={{
                          flex: 1,
                          padding: '0.4rem',
                          fontSize: '0.8rem',
                          background: 'transparent',
                          color: 'var(--danger)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}

                {/* 2. Nhân viên tạo trong Cài đặt (staffList) */}
                {filteredSessionStaff.map(item => (
                  <div
                    key={`session_staff_${item.id}`}
                    className="premium-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      padding: '1.25rem 1rem',
                      borderRadius: '0.75rem',
                      border: '1px solid var(--border)',
                      background: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: 'rgba(109, 40, 217, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                      marginBottom: '0.75rem'
                    }}>
                      <User size={26} />
                    </div>
                    <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)', wordBreak: 'break-word', lineHeight: '1.3' }}>
                      {item.full_name}
                    </h4>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      {getStaffPositionLabel(item.position)}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenStaffModal(item)}
                        className="btn"
                        style={{
                          flex: 1,
                          padding: '0.4rem',
                          fontSize: '0.8rem',
                          background: 'transparent',
                          color: 'var(--primary)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteStaff(item.id)}
                        className="btn"
                        style={{
                          flex: 1,
                          padding: '0.4rem',
                          fontSize: '0.8rem',
                          background: 'transparent',
                          color: 'var(--danger)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Place Table */}
        {activeTab === 'place' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600' }}>Tên chỗ</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600' }}>Loại</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600' }}>Trạng thái</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlaces.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-light)' }}>
                      Chưa có chỗ nào trong danh sách
                    </td>
                  </tr>
                ) : (
                  filteredPlaces.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.875rem 1.5rem', fontWeight: '600', color: 'var(--text-main)' }}>{item.name}</td>
                      <td style={{ padding: '0.875rem 1.5rem' }}>
                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '600' }}>
                          {item.type}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1.5rem' }}>
                        <span style={{ 
                          background: item.status === 'Hoạt động' ? '#dcfce7' : '#fee2e2', 
                          color: item.status === 'Hoạt động' ? '#15803d' : '#b91c1c', 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '0.375rem', 
                          fontSize: '0.75rem', 
                          fontWeight: '600' 
                        }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1.5rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenPlaceModal(item)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)', marginRight: '0.75rem', padding: '0.25rem' }}
                          title="Sửa"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deletePlace(item.id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Service Table */}
        {activeTab === 'service' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600' }}>Tên dịch vụ</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600' }}>Đơn giá</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600' }}>Thời lượng</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600' }}>Trạng thái</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-light)' }}>
                      Chưa có dịch vụ nào trong danh sách
                    </td>
                  </tr>
                ) : (
                  filteredServices.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.875rem 1.5rem', fontWeight: '600', color: 'var(--text-main)' }}>{item.name}</td>
                      <td style={{ padding: '0.875rem 1.5rem', fontWeight: '700', color: 'var(--primary)' }}>{formatCurrency(item.price)}</td>
                      <td style={{ padding: '0.875rem 1.5rem', color: 'var(--text-secondary)' }}>{item.duration_minutes} phút</td>
                      <td style={{ padding: '0.875rem 1.5rem' }}>
                        <span style={{ 
                          background: item.status === 'Đang phục vụ' ? '#dcfce7' : '#fee2e2', 
                          color: item.status === 'Đang phục vụ' ? '#15803d' : '#b91c1c', 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '0.375rem', 
                          fontSize: '0.75rem', 
                          fontWeight: '600' 
                        }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1.5rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenServiceModal(item)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)', marginRight: '0.75rem', padding: '0.25rem' }}
                          title="Sửa"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteService(item.id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Invoice Table */}
        {activeTab === 'invoice' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1.5rem', width: '40px' }}>
                    <button
                      onClick={handleToggleSelectAllInvoices}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, color: 'var(--text-secondary)' }}
                      title="Chọn tất cả"
                    >
                      {invoiceList.length > 0 && selectedInvoiceIds.length === invoiceList.length ? (
                        <CheckSquare size={18} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600' }}>Mã hóa đơn</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600' }}>Tên khách</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600' }}>Dịch vụ</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600' }}>Số tiền</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600' }}>Thời gian</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: '600', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-light)' }}>
                      Chưa có hóa đơn nào trong danh sách
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(item => {
                    const isSelected = selectedInvoiceIds.includes(item.id);
                    return (
                      <tr 
                        key={item.id} 
                        style={{ 
                          borderBottom: '1px solid var(--border)',
                          background: isSelected ? 'rgba(109, 40, 217, 0.04)' : 'transparent' 
                        }}
                      >
                        <td style={{ padding: '0.875rem 1.5rem' }}>
                          <button
                            onClick={() => handleToggleSelectInvoice(item.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, color: 'var(--text-secondary)' }}
                          >
                            {isSelected ? (
                              <CheckSquare size={18} style={{ color: 'var(--primary)' }} />
                            ) : (
                              <Square size={18} />
                            )}
                          </button>
                        </td>
                        <td style={{ padding: '0.875rem 1.5rem', fontWeight: '700', fontFamily: 'monospace', color: 'var(--primary)' }}>
                          {item.invoice_code}
                        </td>
                        <td style={{ padding: '0.875rem 1.5rem', fontWeight: '600', color: 'var(--text-main)' }}>{item.customer_name}</td>
                        <td style={{ padding: '0.875rem 1.5rem', color: 'var(--text-secondary)' }}>{item.service_name}</td>
                        <td style={{ padding: '0.875rem 1.5rem', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(item.amount)}</td>
                        <td style={{ padding: '0.875rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{item.created_at}</td>
                        <td style={{ padding: '0.875rem 1.5rem', textAlign: 'right' }}>
                          <button
                            onClick={() => deleteInvoices([item.id])}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}
                            title="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- Modal: Nhân viên --- */}
      {staffModalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '450px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>
                {editingStaffId ? 'Cập nhật nhân viên' : 'Thêm nhân viên'}
              </h3>
              <button onClick={() => setStaffModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Họ và tên *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={staffForm.full_name}
                  onChange={e => setStaffForm({ ...staffForm, full_name: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Số điện thoại</label>
                <input
                  type="text"
                  placeholder="090xxxxxxx"
                  value={staffForm.phone}
                  onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Vị trí</label>
                <input
                  type="text"
                  readOnly
                  value="KTV"
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem', background: '#f8fafc', color: 'var(--text-main)', cursor: 'default' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Trạng thái</label>
                <select
                  value={staffForm.status}
                  onChange={e => setStaffForm({ ...staffForm, status: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                >
                  <option value="Đang làm">Đang làm</option>
                  <option value="Nghỉ việc">Nghỉ việc</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setStaffModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.25rem' }}
                >
                  {editingStaffId ? 'Lưu thay đổi' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- Modal: Chỗ --- */}
      {placeModalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '450px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>
                {editingPlaceId ? 'Cập nhật chỗ' : 'Thêm chỗ'}
              </h3>
              <button onClick={() => setPlaceModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePlace} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Tên chỗ *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Phòng 01, Giường 01"
                  value={placeForm.name}
                  onChange={e => setPlaceForm({ ...placeForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Loại</label>
                <select
                  value={placeForm.type}
                  onChange={e => setPlaceForm({ ...placeForm, type: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                >
                  <option value="Giường">Giường</option>
                  <option value="Phòng">Phòng</option>
                  <option value="Ghế">Ghế</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Trạng thái</label>
                <select
                  value={placeForm.status}
                  onChange={e => setPlaceForm({ ...placeForm, status: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                >
                  <option value="Hoạt động">Hoạt động</option>
                  <option value="Bảo trì">Bảo trì</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setPlaceModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.25rem' }}
                >
                  {editingPlaceId ? 'Lưu thay đổi' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- Modal: Dịch vụ --- */}
      {serviceModalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '450px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>
                {editingServiceId ? 'Cập nhật dịch vụ' : 'Thêm dịch vụ'}
              </h3>
              <button onClick={() => setServiceModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveService} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Tên dịch vụ *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Gội đầu dưỡng sinh"
                  value={serviceForm.name}
                  onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Đơn giá (VNĐ) *</label>
                <input
                  type="number"
                  required
                  step="1000"
                  min="0"
                  value={serviceForm.price}
                  onChange={e => setServiceForm({ ...serviceForm, price: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Thời lượng (phút)</label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={serviceForm.duration_minutes}
                  onChange={e => setServiceForm({ ...serviceForm, duration_minutes: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Trạng thái</label>
                <select
                  value={serviceForm.status}
                  onChange={e => setServiceForm({ ...serviceForm, status: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                >
                  <option value="Đang phục vụ">Đang phục vụ</option>
                  <option value="Tạm ngưng">Tạm ngưng</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setServiceModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.25rem' }}
                >
                  {editingServiceId ? 'Lưu thay đổi' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- Modal: Hóa đơn --- */}
      {invoiceModalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '450px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>
                Tạo hóa đơn
              </h3>
              <button onClick={() => setInvoiceModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Mã hóa đơn *</label>
                <input
                  type="text"
                  required
                  placeholder="#HD07094722 hoặc #HD-001"
                  value={invoiceForm.invoice_code}
                  onChange={e => setInvoiceForm({ ...invoiceForm, invoice_code: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace', fontWeight: '600' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Tên khách hàng</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={invoiceForm.customer_name}
                  onChange={e => setInvoiceForm({ ...invoiceForm, customer_name: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Dịch vụ</label>
                {serviceList.length > 0 ? (
                  <select
                    value={invoiceForm.service_name}
                    onChange={e => {
                      const found = serviceList.find(s => s.name === e.target.value);
                      setInvoiceForm({
                        ...invoiceForm,
                        service_name: e.target.value,
                        amount: found ? found.price : invoiceForm.amount
                      });
                    }}
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  >
                    {serviceList.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({formatCurrency(s.price)})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Ví dụ: Massage toàn thân"
                    value={invoiceForm.service_name}
                    onChange={e => setInvoiceForm({ ...invoiceForm, service_name: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Số tiền (VNĐ) *</label>
                <input
                  type="number"
                  required
                  step="1000"
                  min="0"
                  value={invoiceForm.amount}
                  onChange={e => setInvoiceForm({ ...invoiceForm, amount: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.25rem' }}
                >
                  Tạo hóa đơn
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Settings;
