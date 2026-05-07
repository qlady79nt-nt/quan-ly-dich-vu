import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [detailModal, setDetailModal] = useState<any>(null);

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

  const handleViewInvoice = async (inv: any) => {
    setLoading(true);
    try {
      let { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id);
      items = items || [];
      
      let realStaffName = inv.profiles?.full_name || 'Hệ thống';
      let totalSessions = 0;
      let isPackageSale = items.some(i => i.type === 'package_sale');

      // Hook directly from invoice_items first
      const firstItemWithStaff = items.find(i => i.staff_id);
      if (firstItemWithStaff && firstItemWithStaff.staff_id) {
         const { data: stf } = await supabase.from('profiles').select('full_name').eq('id', firstItemWithStaff.staff_id).single();
         if (stf) realStaffName = stf.full_name;
      }

      if (items.length === 0) {
        const { data: psArray, error: psErr } = await supabase.from('package_sales').select('*').eq('invoice_id', inv.id);
        if (psErr) console.error('Error fetching package_sales:', psErr);
        
        if (psArray && psArray.length > 0) {
          const ps = psArray[0];
          isPackageSale = true;

          if (ps.seller_id) {
             const { data: stf } = await supabase.from('profiles').select('full_name').eq('id', ps.seller_id).single();
             if (stf) realStaffName = stf.full_name;
          }

          if (ps.customer_package_id) {
             const { data: cp } = await supabase.from('customer_packages').select('*').eq('id', ps.customer_package_id).single();
             if (cp) {
                totalSessions = cp.total_sessions || 0;
                if (!inv.card_code && cp.card_code) inv.card_code = cp.card_code;

                let pkgName = 'Gói liệu trình';
                if (cp.package_id) {
                   const { data: pkg } = await supabase.from('packages').select('name').eq('id', cp.package_id).single();
                   if (pkg) pkgName = pkg.name;
                }

                items.push({ 
                  name: pkgName, 
                  price: ps.amount_paid 
                });
             }
          }
        }
      } else if (isPackageSale) {
        let { data: psArray } = await supabase.from('package_sales').select('*').eq('invoice_id', inv.id);
        
        if (!psArray || psArray.length === 0) {
           const createdTime = new Date(inv.created_at).getTime();
           const startTime = new Date(createdTime - 15000).toISOString();
           const endTime = new Date(createdTime + 15000).toISOString();
           
           const { data: cpArray } = await supabase.from('customer_packages')
             .select('id')
             .gte('created_at', startTime)
             .lte('created_at', endTime)
             .eq('customer_phone', inv.customer_phone);
             
           if (cpArray && cpArray.length > 0) {
              const { data: healedPs } = await supabase.from('package_sales').select('*').eq('customer_package_id', cpArray[0].id);
              if (healedPs) psArray = healedPs;
           }
        }

        if (psArray && psArray.length > 0) {
          const ps = psArray[0];
          // Nếu invoice_items không có staff_id, lấy bù từ package_sales
          if (!firstItemWithStaff && ps.seller_id) {
             const { data: stf } = await supabase.from('profiles').select('full_name').eq('id', ps.seller_id).single();
             if (stf) realStaffName = stf.full_name;
          }
          if (ps.customer_package_id) {
             const { data: cp } = await supabase.from('customer_packages').select('*').eq('id', ps.customer_package_id).single();
             if (cp) {
                totalSessions = cp.total_sessions || 0;
                if (!inv.card_code && cp.card_code) inv.card_code = cp.card_code;
             }
          }
        }
      }

      // 1.5. Ultimate Fallback Recovery: Nếu items VẪN rỗng (lỗi cả invoice_items và package_sales)
      if (items.length === 0) {
         const createdTime = new Date(inv.created_at).getTime();
         const startTime = new Date(createdTime - 15000).toISOString();
         const endTime = new Date(createdTime + 15000).toISOString();
         
         const { data: cpArray } = await supabase.from('customer_packages')
           .select('*')
           .gte('created_at', startTime)
           .lte('created_at', endTime)
           .eq('customer_phone', inv.customer_phone);
           
         if (cpArray && cpArray.length > 0) {
            isPackageSale = true;
            realStaffName = 'Không xác định (Lỗi hệ thống cũ không lưu)';
            const cp = cpArray[0];
            totalSessions = cp.total_sessions || 0;
            if (!inv.card_code && cp.card_code) inv.card_code = cp.card_code;
            
            let pkgName = 'Gói liệu trình';
            if (cp.package_id) {
               const { data: pkg } = await supabase.from('packages').select('name').eq('id', cp.package_id).single();
               if (pkg) pkgName = pkg.name;
            }
            
            items.push({ 
              name: pkgName, 
              price: cp.sale_price 
            });
         }
      }

      // 2. Resolve real names for items that only have ref_id
      for (let i = 0; i < items.length; i++) {
        if (!items[i].name) {
          if (items[i].type === 'package_sale' || items[i].type === 'package') {
            const { data: pkg } = await supabase.from('packages').select('name').eq('id', items[i].ref_id).single();
            if (pkg) items[i].name = pkg.name;
          } else if (items[i].type === 'service') {
            const { data: svc } = await supabase.from('services').select('name').eq('id', items[i].ref_id).single();
            if (svc) items[i].name = svc.name;
          }
        }
      }

      setDetailModal({
        type: 'invoice',
        data: { 
          ...inv, 
          items: items, 
          real_staff_name: realStaffName,
          total_sessions: totalSessions,
          is_package_sale: isPackageSale
        },
        title: 'Chi tiết Hoá đơn'
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleViewSession = async (sess: any) => {
    setLoading(true);
    let invoiceCode = '';
    try {
      if (sess.customer_package_id) {
         // Try fetching from package_sales first
         const { data: ps } = await supabase.from('package_sales').select('invoice_id').eq('customer_package_id', sess.customer_package_id).single();
         if (ps && ps.invoice_id) {
            invoiceCode = ps.invoice_id;
         } else if (sess.customer_packages?.customer_phone && sess.customer_packages?.created_at) {
            // Ultimate fallback for corrupted invoices
            const createdTime = new Date(sess.customer_packages.created_at).getTime();
            const startTime = new Date(createdTime - 15000).toISOString();
            const endTime = new Date(createdTime + 15000).toISOString();
            
            const { data: invArray } = await supabase.from('invoices')
              .select('id')
              .gte('created_at', startTime)
              .lte('created_at', endTime)
              .eq('customer_phone', sess.customer_packages.customer_phone);
              
            if (invArray && invArray.length > 0) {
               invoiceCode = invArray[0].id;
            }
         }
      }
    } catch (e) {
      console.error(e);
    }
    
    setDetailModal({
      type: 'session',
      data: { ...sess, original_invoice_code: invoiceCode },
      title: 'Chi tiết Phiếu trừ buổi'
    });
    setLoading(false);
  };

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
                <tr 
                  key={inv.id} 
                  onClick={() => handleViewInvoice(inv)}
                  style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(109, 40, 217, 0.05)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
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
                <tr 
                  key={sess.id} 
                  onClick={() => handleViewSession(sess)}
                  style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(109, 40, 217, 0.05)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
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

      {detailModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              {detailModal.title}
            </h3>
            
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1.5rem' }}>
              {detailModal.type === 'invoice' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Mã Hoá Đơn:</span>
                    <span style={{ fontWeight: '600' }}>#{detailModal.data.id.slice(0,8)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Khách hàng:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer_name || 'Khách lẻ'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Số điện thoại:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer_phone ? `***${detailModal.data.customer_phone.slice(-3)}` : 'Không có'}</span>
                  </div>
                  {detailModal.data.card_code && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Mã liệu trình:</span>
                      <span style={{ fontWeight: '600' }}>***{detailModal.data.card_code.slice(-2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Nhân viên bán hàng:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.real_staff_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ngày tạo:</span>
                    <span>{new Date(detailModal.data.created_at).toLocaleString()}</span>
                  </div>
                  
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Sản phẩm / Dịch vụ</h4>
                  <div style={{ background: 'var(--bg-main)', borderRadius: '0.5rem', padding: '1rem' }}>
                    {detailModal.data.items?.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem 0', fontStyle: 'italic' }}>
                        Dữ liệu chi tiết của hoá đơn này đã bị mất do lỗi hệ thống cũ trước khi cập nhật. Vui lòng tạo hoá đơn mới để kiểm tra.
                      </div>
                    ) : (
                      <>
                        {detailModal.data.items?.map((item: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span>{item.name || item.service_name || 'Dịch vụ'}</span>
                            <span>{Number(item.price || item.unit_price).toLocaleString()}đ</span>
                          </div>
                        ))}
                        
                        {detailModal.data.is_package_sale && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Tổng số buổi mua:</span>
                            <span style={{ fontWeight: '600' }}>{detailModal.data.total_sessions} buổi</span>
                          </div>
                        )}
                      </>
                    )}

                    <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: 'var(--primary)', fontSize: '1.1rem' }}>
                      <span>Tổng cộng:</span>
                      <span>{Number(detailModal.data.final_amount).toLocaleString()}đ</span>
                    </div>
                  </div>
                </div>
              )}

              {detailModal.type === 'session' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Mã Phiếu:</span>
                    <span style={{ fontWeight: '600' }}>#{detailModal.data.id.slice(0,8)}</span>
                  </div>
                  {detailModal.data.original_invoice_code && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Mã hoá đơn (Gốc):</span>
                      <span style={{ fontWeight: '600', color: 'var(--primary)' }}>#{detailModal.data.original_invoice_code.slice(0,8)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Khách hàng:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer_packages?.customer_name || 'Khách lẻ'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Số điện thoại:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer_packages?.customer_phone ? `***${detailModal.data.customer_packages.customer_phone.slice(-3)}` : 'Không có'}</span>
                  </div>
                  {detailModal.data.customer_packages?.card_code && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Mã liệu trình:</span>
                      <span style={{ fontWeight: '600' }}>***{detailModal.data.customer_packages.card_code.slice(-2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Kỹ thuật viên:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.profiles?.full_name || 'KTV'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ngày dùng:</span>
                    <span>{new Date(detailModal.data.created_at).toLocaleString()}</span>
                  </div>
                  
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Thông tin Gói</h4>
                  <div style={{ background: 'var(--bg-main)', borderRadius: '0.5rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '600' }}>{detailModal.data.customer_packages?.packages?.name || 'Gói liệu trình'}</span>
                      <span style={{ color: 'var(--primary)', fontWeight: '600' }}>- 1 Buổi</span>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      <span>Tổng số buổi:</span>
                      <span>{detailModal.data.customer_packages?.total_sessions} buổi</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      <span>Đã sử dụng:</span>
                      <span>{detailModal.data.customer_packages?.used_sessions} buổi</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: 'var(--success)', marginTop: '0.5rem' }}>
                      <span>Còn lại:</span>
                      <span>{(detailModal.data.customer_packages?.total_sessions || 0) - (detailModal.data.customer_packages?.used_sessions || 0)} buổi</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <button onClick={() => setDetailModal(null)} className="btn" style={{ background: 'var(--bg-main)', width: '100%' }}>Đóng</button>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default Invoices;
