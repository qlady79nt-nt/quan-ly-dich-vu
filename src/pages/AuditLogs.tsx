import { useState, useEffect } from 'react';
import { ShieldAlert, Loader2, Search, History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const AuditLogs = () => {
  const { profile } = useAuth();
  
  // Dành cho Super Admin, lấy luôn danh sách cửa hàng để hiển thị
  const [shopsMap, setShopsMap] = useState<Record<string, string>>({});
  
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Nếu là Super Admin, kéo danh sách shop
      if (profile?.role === 'super_admin') {
        const { data: shops } = await supabase.from('shops').select('id, name');
        if (shops) {
          const map: Record<string, string> = {};
          shops.forEach(s => map[s.id] = s.name);
          setShopsMap(map);
        }
      }

      // Kéo logs (RLS sẽ tự động chặn theo quyền shop_admin hay super_admin)
      let query = supabase.from('audit_logs')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(100); // Lấy 100 log gần nhất
        
      const { data, error } = await query;
      
      if (error) throw error;
      setLogs(data || []);
    } catch (e: any) {
      console.error('Error fetching audit logs', e);
    }
    setLoading(false);
  };

  const getActionColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('RESET')) return 'var(--danger)';
    if (action.includes('DISCOUNT') || action.includes('EDIT')) return 'var(--warning)';
    if (action.includes('LOGIN') || action.includes('CREATE')) return 'var(--success)';
    return 'var(--primary)';
  };

  const getActionName = (action: string) => {
    const dict: Record<string, string> = {
      'DELETE_INVOICE': 'Xóa Hoá Đơn',
      'APPLY_DISCOUNT': 'Giảm Giá Thủ Công',
      'RESET_PASSWORD': 'Reset Mật Khẩu',
      'DELETE_STAFF': 'Xóa Nhân Viên',
      'LOGIN': 'Đăng Nhập',
      'UPDATE_SETTINGS': 'Đổi Cấu Hình'
    };
    return dict[action] || action;
  };

  const filteredLogs = logs.filter(log => {
    const matchSearch = log.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        log.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAction = filterAction === 'ALL' || log.action_type === filterAction;
    return matchSearch && matchAction;
  });

  if (profile?.role !== 'super_admin') {
    return <div style={{ textAlign: 'center', padding: '5rem' }}>Tính năng này hiện chỉ mở thử nghiệm cho Super Admin</div>;
  }

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert className="text-danger" /> Nhật ký Hoạt động (Audit Logs)
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Theo dõi các hành động nhạy cảm của quản trị viên và nhân viên trên toàn hệ thống</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select className="form-select" value={filterAction} onChange={e => setFilterAction(e.target.value)}>
            <option value="ALL">-- Tất cả hành động --</option>
            <option value="DELETE_INVOICE">Xóa Hoá Đơn</option>
            <option value="APPLY_DISCOUNT">Giảm Giá</option>
            <option value="RESET_PASSWORD">Reset Mật Khẩu</option>
          </select>

          <div className="search-container" style={{ width: '300px' }}>
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Tìm theo nội dung, tên người dùng..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem' }}><Loader2 className="animate-spin" size={40} /></div>
      ) : (
        <div className="premium-card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                <th style={{ padding: '1rem' }}>Thời gian</th>
                <th>Người thực hiện</th>
                {profile?.role === 'super_admin' && <th>Cửa hàng</th>}
                <th>Loại Hành Động</th>
                <th>Mô tả chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr 
                  key={log.id} 
                  style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(109, 40, 217, 0.05)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{new Date(log.created_at).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.75rem' }}>{new Date(log.created_at).toLocaleTimeString()}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{log.profiles?.full_name || 'Hệ thống'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Người dùng nội bộ</div>
                  </td>
                  {profile?.role === 'super_admin' && (
                    <td style={{ color: 'var(--primary)', fontWeight: '600' }}>
                      {shopsMap[log.shop_id] || 'Unknown'}
                    </td>
                  )}
                  <td>
                    <span style={{ 
                      fontSize: '0.75rem', fontWeight: '700', padding: '0.25rem 0.5rem', borderRadius: '1rem',
                      color: getActionColor(log.action_type),
                      background: `${getActionColor(log.action_type)}15`
                    }}>
                      {getActionName(log.action_type)}
                    </span>
                  </td>
                  <td style={{ maxWidth: '300px' }}>
                    <div style={{ fontWeight: '500' }}>{log.description}</div>
                    {log.entity_id && <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>Dữ liệu hệ thống</div>}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                  <History size={40} style={{ opacity: 0.2, margin: '0 auto 1rem auto' }} />
                  Không có nhật ký hệ thống nào.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
