import { useState, useEffect } from 'react';
import { FileText, Loader2, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Invoices = () => {
  const { hasPermission, profile } = useAuth();
  const shopId = profile?.shop_id;

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [view, setView] = useState<'retail' | 'session'>('retail');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (shopId) fetchData();
  }, [shopId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Invoices (Bán hàng) - Manual Join
      const { data: invData, error: invErr } = await supabase.from('invoices').select('*').eq('shop_id', shopId).order('created_at', { ascending: false });
      if (invErr) console.error(invErr);
      
      let finalInvoices = invData || [];
      if (finalInvoices.length > 0) {
        const creatorIds = [...new Set(finalInvoices.map(i => i.created_by).filter(Boolean))];
        if (creatorIds.length > 0) {
          const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', creatorIds);
          finalInvoices = finalInvoices.map(i => ({
            ...i,
            profiles: profs?.find(p => p.id === i.created_by) || { full_name: 'Nhân viên' }
          }));
        }
      }
      setInvoices(finalInvoices);

      // 2. Fetch Sessions (Trừ buổi) - Manual Join
      const { data: sessData, error: sessErr } = await supabase.from('service_sessions').select('*').eq('shop_id', shopId).order('created_at', { ascending: false });
      if (sessErr) console.error(sessErr);
      
      let finalSessions = sessData || [];
      if (finalSessions.length > 0) {
        const cpIds = [...new Set(finalSessions.map(s => s.customer_package_id).filter(Boolean))];
        const staffIds = [...new Set(finalSessions.map(s => s.staff_id).filter(Boolean))];
        
        let cpMap: any[] = [];
        let packagesMap: any[] = [];
        let staffMap: any[] = [];

        if (cpIds.length > 0) {
          const { data: cps } = await supabase.from('customer_packages').select('*').in('id', cpIds);
          cpMap = cps || [];
          
          const pkgIds = [...new Set(cpMap.map(c => c.package_id).filter(Boolean))];
          if (pkgIds.length > 0) {
            const { data: pkgs } = await supabase.from('packages').select('id, name').in('id', pkgIds);
            packagesMap = pkgs || [];
          }
        }

        if (staffIds.length > 0) {
          const { data: staffs } = await supabase.from('profiles').select('id, full_name').in('id', staffIds);
          staffMap = staffs || [];
        }

        finalSessions = finalSessions.map(s => {
          const cp = cpMap.find(c => c.id === s.customer_package_id);
          const pkg = cp ? packagesMap.find(p => p.id === cp.package_id) : null;
          return {
            ...s,
            customer_packages: cp ? { ...cp, packages: pkg } : null,
            profiles: staffMap.find(st => st.id === s.staff_id) || { full_name: 'KTV' }
          };
        });
      }
      setSessions(finalSessions);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (inv.customer_name && inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredSessions = sessions.filter(sess => 
    sess.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (sess.customer_packages?.customer_name && sess.customer_packages.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (sess.customer_packages?.customer_phone && sess.customer_packages.customer_phone.includes(searchTerm))
  );

  if (!hasPermission('report.invoice.view')) {
    return <div style={{ textAlign: 'center', padding: '5rem' }}>Bạn không có quyền xem danh sách hoá đơn</div>;
  }

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Quản lý Hoá đơn & Phiếu</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Tra cứu hoá đơn bán hàng và lịch sử trừ buổi</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="search-container" style={{ width: '300px' }}>
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Tìm theo tên khách, mã..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setView('retail')} className="btn" style={{ background: view === 'retail' ? 'var(--primary)' : 'var(--bg-main)', color: view === 'retail' ? 'white' : 'inherit' }}>
          <FileText size={18} /> Hoá đơn bán hàng
        </button>
        <button onClick={() => setView('session')} className="btn" style={{ background: view === 'session' ? 'var(--primary)' : 'var(--bg-main)', color: view === 'session' ? 'white' : 'inherit' }}>
          <Filter size={18} /> Phiếu dùng liệu trình
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem' }}><Loader2 className="animate-spin" size={40} /></div>
      ) : view === 'retail' ? (
        <div className="premium-card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                <th style={{ padding: '1rem' }}>Mã Hoá Đơn</th>
                <th>Khách hàng</th>
                <th>Ngày bán</th>
                <th>Người tạo</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(inv => (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                  <td style={{ padding: '1rem', fontWeight: '600' }}>#{inv.id.slice(0,8)}</td>
                  <td>{inv.customer_name || 'Khách lẻ'}</td>
                  <td>{new Date(inv.created_at).toLocaleString()}</td>
                  <td>{inv.profiles?.full_name || 'Hệ thống'}</td>
                  <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{Number(inv.final_amount).toLocaleString()}đ</td>
                  <td>
                    <span className={`badge ${inv.status === 'paid' ? 'badge-success' : inv.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                      {inv.status === 'paid' ? 'Đã thanh toán' : inv.status === 'cancelled' ? 'Đã huỷ' : 'Chờ thanh toán'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>Không có dữ liệu hoá đơn</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="premium-card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                <th style={{ padding: '1rem' }}>Mã Phiếu</th>
                <th>Khách hàng</th>
                <th>Gói dịch vụ</th>
                <th>Ngày dùng</th>
                <th>Kỹ thuật viên</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map(sess => (
                <tr key={sess.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                  <td style={{ padding: '1rem', fontWeight: '600', color: 'var(--secondary)' }}>#{sess.id.slice(0,8)}</td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{sess.customer_packages?.customer_name || 'N/A'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{sess.customer_packages?.customer_phone}</div>
                  </td>
                  <td>{sess.customer_packages?.packages?.name || 'N/A'}</td>
                  <td>{new Date(sess.created_at).toLocaleString()}</td>
                  <td>{sess.profiles?.full_name || 'N/A'}</td>
                  <td><span className="badge badge-success">Đã hoàn thành</span></td>
                </tr>
              ))}
              {filteredSessions.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>Không có phiếu trừ buổi nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Invoices;
