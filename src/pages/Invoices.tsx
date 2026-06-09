import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Loader2, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { TableSkeleton } from '../components/Skeleton';

const Invoices = () => {
  const { hasPermission, profile } = useAuth();
  const shopId = profile?.shop_id;

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [view, setView] = useState<'retail' | 'session'>('retail');
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState(() => {
    return new URLSearchParams(window.location.search).get('search') || '';
  });
  const [detailModal, setDetailModal] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (shopId) fetchData();
  }, [shopId, dateFilter, customStartDate, customEndDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const applyDateFilter = (query: any) => {
        const effectiveFilter = profile?.role === 'shop_admin' ? dateFilter : 'today';

        if (effectiveFilter === 'today') {
          const tomorrow = new Date(todayStart);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return query.gte('created_at', todayStart.toISOString()).lt('created_at', tomorrow.toISOString());
        }
        if (effectiveFilter === '7days') {
          const sevenDaysAgo = new Date(todayStart);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return query.gte('created_at', sevenDaysAgo.toISOString());
        }
        if (effectiveFilter === 'month') {
          const firstDayOfMonth = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
          return query.gte('created_at', firstDayOfMonth.toISOString());
        }
        if (effectiveFilter === 'custom') {
          let q = query;
          if (customStartDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            q = q.gte('created_at', start.toISOString());
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            q = q.lte('created_at', end.toISOString());
          }
          return q;
        }
        return query; // 'all'
      };

      // 1. Fetch Invoices (Bán hàng) - Manual Join
      let invQuery = supabase.from('invoices').select('*').eq('shop_id', shopId).order('created_at', { ascending: false });
      invQuery = applyDateFilter(invQuery);
      
      const { data: invData, error: invErr } = await invQuery;
      if (invErr) console.error(invErr);

      let finalInvoices = invData || [];
      if (finalInvoices.length > 0) {
        const invoiceIds = finalInvoices.map(i => i.id);
        
        const creatorIds = [...new Set(finalInvoices.map(i => i.created_by).filter(Boolean))];
        let profs: any[] = [];
        if (creatorIds.length > 0) {
          const { data } = await supabase.from('profiles').select('id, full_name').in('id', creatorIds);
          if (data) profs = data;
        }

        const { data: revLogs } = await supabase.from('revenue_logs').select('invoice_id, service_session_id').in('invoice_id', invoiceIds).in('type', ['retail', 'combo']);
        const sessionIds = [...new Set((revLogs || []).map(r => r.service_session_id).filter(Boolean))];
        let sessionsList: any[] = [];
        if (sessionIds.length > 0) {
          const { data } = await supabase.from('service_sessions').select('id, staff_id').in('id', sessionIds);
          if (data) sessionsList = data;
        }

        const { data: pkgSales } = await supabase.from('package_sales').select('invoice_id, seller_id').in('invoice_id', invoiceIds);

        const staffIds = [...new Set([
          ...sessionsList.map(s => s.staff_id),
          ...(pkgSales || []).map(p => p.seller_id)
        ].filter(Boolean))];

        let staffs: any[] = [];
        if (staffIds.length > 0) {
          const { data } = await supabase.from('staffs').select('id, full_name').in('id', staffIds);
          if (data) staffs = data;
        }

        finalInvoices = finalInvoices.map(inv => {
          let realStaffName = '';

          const ps = (pkgSales || []).find(p => p.invoice_id === inv.id);
          if (ps && ps.seller_id) {
            const stf = staffs.find(s => s.id === ps.seller_id);
            if (stf) realStaffName = stf.full_name;
          } else {
            const invRevLogs = (revLogs || []).filter(r => r.invoice_id === inv.id);
            if (invRevLogs.length > 0) {
              const invSessionIds = invRevLogs.map(r => r.service_session_id);
              const invSessions = sessionsList.filter(s => invSessionIds.includes(s.id));
              const invStaffIds = [...new Set(invSessions.map(s => s.staff_id).filter(Boolean))];
              if (invStaffIds.length > 0) {
                const invStaffs = staffs.filter(s => invStaffIds.includes(s.id));
                if (invStaffs.length > 0) {
                  realStaffName = invStaffs.map(s => s.full_name).join(', ');
                }
              }
            }
          }

          const creator = profs.find(p => p.id === inv.created_by);
          if (!realStaffName && creator) {
             realStaffName = creator.full_name;
          }

          return {
            ...inv,
            real_staff_name: realStaffName || 'Hệ thống',
            profiles: creator || { full_name: 'Hệ thống' }
          };
        });
      }
      setInvoices(finalInvoices);

      // 2. Fetch Sessions (Trừ buổi) - Manual Join
      let sessQuery = supabase.from('service_sessions')
        .select('*')
        .eq('shop_id', shopId)
        .not('customer_package_id', 'is', null)
        .order('created_at', { ascending: false });
      sessQuery = applyDateFilter(sessQuery);
      
      const { data: sessData, error: sessErr } = await sessQuery;
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
          const { data: staffs } = await supabase.from('staffs').select('id, full_name').in('id', staffIds);
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
    (inv.invoice_code && inv.invoice_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (inv.customer_name && inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredSessions = sessions.filter(sess =>
    (sess.session_code && sess.session_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
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
      let usedSessions = 0;
      let customerPackageId = null;
      let isPackageSale = items.some(i => i.type === 'package_sale');

      // No longer check invoice_items for staff_id since it is a pure financial line
      if (items.length === 0) {
        const { data: psArray, error: psErr } = await supabase.from('package_sales').select('*').eq('invoice_id', inv.id);
        if (psErr) console.error('Error fetching package_sales:', psErr);

        if (psArray && psArray.length > 0) {
          const ps = psArray[0];
          isPackageSale = true;

          if (ps.seller_id) {
            const { data: stf } = await supabase.from('staffs').select('full_name').eq('id', ps.seller_id).single();
            if (stf) realStaffName = stf.full_name;
          }

          if (ps.customer_package_id) {
            const { data: cp } = await supabase.from('customer_packages').select('*').eq('id', ps.customer_package_id).single();
            if (cp) {
              totalSessions = cp.total_sessions || 0;
              usedSessions = cp.used_sessions || 0;
              customerPackageId = cp.id;
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
          // Lấy bù từ package_sales
          if (ps.seller_id) {
            const { data: stf } = await supabase.from('staffs').select('full_name').eq('id', ps.seller_id).single();
            if (stf) realStaffName = stf.full_name;
          }
          if (ps.customer_package_id) {
            const { data: cp } = await supabase.from('customer_packages').select('*').eq('id', ps.customer_package_id).single();
            if (cp) {
              totalSessions = cp.total_sessions || 0;
              usedSessions = cp.used_sessions || 0;
              customerPackageId = cp.id;
              if (!inv.card_code && cp.card_code) inv.card_code = cp.card_code;
            }
          }
        }
      } else {
        // Hóa đơn dịch vụ lẻ (Retail) hoặc Combo
        const { data: revLogs } = await supabase.from('revenue_logs').select('service_session_id').eq('invoice_id', inv.id).in('type', ['retail', 'combo']);
        if (revLogs && revLogs.length > 0) {
          const sessionIds = [...new Set(revLogs.map((r: any) => r.service_session_id).filter(Boolean))];
          if (sessionIds.length > 0) {
            const { data: sessions } = await supabase.from('service_sessions').select('staff_id').in('id', sessionIds);
            if (sessions && sessions.length > 0) {
              const staffIds = [...new Set(sessions.map((s: any) => s.staff_id).filter(Boolean))];
              if (staffIds.length > 0) {
                const { data: staffs } = await supabase.from('staffs').select('full_name').in('id', staffIds);
                if (staffs && staffs.length > 0) {
                  realStaffName = staffs.map((s: any) => s.full_name).join(', ');
                }
              }
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
          usedSessions = cp.used_sessions || 0;
          customerPackageId = cp.id;
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

      // 2. Resolve real names for items
      for (let i = 0; i < items.length; i++) {
        if (!items[i].name) {
          if (items[i].type === 'package_sale' || items[i].type === 'package') {
            const idToLook = items[i].package_id;
            if (idToLook) {
              const { data: pkg } = await supabase.from('packages').select('name').eq('id', idToLook).single();
              if (pkg) items[i].name = pkg.name;
            }
          } else if (items[i].type === 'service') {
            const idToLook = items[i].service_id;
            if (idToLook) {
              const { data: svc } = await supabase.from('services').select('name').eq('id', idToLook).single();
              if (svc) items[i].name = svc.name;
            }
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
          used_sessions: usedSessions,
          customer_package_id: customerPackageId,
          is_package_sale: isPackageSale
        },
        title: 'Chi tiết Hoá đơn'
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleCancelInvoice = async () => {
    if (!cancelReason.trim()) return alert('Vui lòng nhập lý do huỷ hoá đơn');

    if (detailModal.data.is_package_sale && detailModal.data.used_sessions > 0) {
      alert('Gói đã phát sinh sử dụng. Không thể hủy hóa đơn.');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn hủy hóa đơn này? Thao tác này không thể hoàn tác.')) return;

    setIsCancelling(true);
    const { error } = await supabase.from('invoices').update({
      status: 'cancelled',
      cancelled_reason: cancelReason,
      cancelled_by: profile?.id
    }).eq('id', detailModal.data.id);

    if (error) {
      alert('Lỗi khi huỷ hoá đơn: ' + error.message);
    } else {
      if (detailModal.data.is_package_sale && detailModal.data.customer_package_id) {
        await supabase.from('customer_packages').update({
          status: 'cancelled',
          cancelled_reason: cancelReason,
          cancelled_by: profile?.id
        }).eq('id', detailModal.data.customer_package_id);

        // Hủy hoa hồng & doanh thu của gói
        await supabase.from('revenue_logs').update({ status: 'cancelled' }).eq('reference_id', detailModal.data.customer_package_id);
        // Hủy thông qua package_sale
        const { data: ps } = await supabase.from('package_sales').select('id').eq('customer_package_id', detailModal.data.customer_package_id);
        if (ps && ps.length > 0) {
          const psIds = ps.map(p => p.id);
          await supabase.from('commission_logs').update({ status: 'cancelled' }).in('package_sale_id', psIds);
          await supabase.from('revenue_logs').update({ status: 'cancelled' }).in('package_sale_id', psIds);
        }
      }

      // Hủy doanh thu và hoa hồng của hoá đơn bán lẻ
      await supabase.from('revenue_logs').update({ status: 'cancelled' }).eq('invoice_id', detailModal.data.id);

      const { data: invItems } = await supabase.from('invoice_items').select('id').eq('invoice_id', detailModal.data.id);
      if (invItems && invItems.length > 0) {
        await supabase.from('commission_logs').update({ status: 'cancelled' }).in('invoice_item_id', invItems.map(i => i.id));
      }

      const { error: auditErr } = await supabase.from('audit_logs').insert([{
        shop_id: shopId,
        actor_id: profile?.id,
        action_type: 'DELETE_INVOICE',
        entity_type: 'INVOICE',
        entity_id: detailModal.data.id,
        description: `Hủy hóa đơn #${detailModal.data.invoice_code || '---'} - Lý do: ${cancelReason}`
      }]);

      if (auditErr) {
        console.error('Lỗi khi ghi Audit Log:', auditErr);
        alert('Lỗi khi ghi Nhật ký: ' + auditErr.message);
      }

      fetchData();
      setDetailModal(null);
      setCancelReason('');
    }
    setIsCancelling(false);
  };

  const handleViewSession = async (sess: any) => {
    setLoading(true);
    let invoiceCode = '';
    try {
      if (sess.customer_package_id) {
        // Try fetching from package_sales first
        const { data: ps } = await supabase.from('package_sales').select('invoice_id, invoices(invoice_code)').eq('customer_package_id', sess.customer_package_id).single();
        if (ps && ps.invoice_id) {
          const invObj: any = ps.invoices;
          invoiceCode = (Array.isArray(invObj) ? invObj[0]?.invoice_code : invObj?.invoice_code) || ps.invoice_id.slice(0, 8);
        } else if (sess.customer_packages?.customer_phone && sess.customer_packages?.created_at) {
          // Ultimate fallback for corrupted invoices
          const createdTime = new Date(sess.customer_packages.created_at).getTime();
          const startTime = new Date(createdTime - 15000).toISOString();
          const endTime = new Date(createdTime + 15000).toISOString();

          const { data: invArray } = await supabase.from('invoices')
            .select('id, invoice_code')
            .gte('created_at', startTime)
            .lte('created_at', endTime)
            .eq('customer_phone', sess.customer_packages.customer_phone);

          if (invArray && invArray.length > 0) {
            invoiceCode = invArray[0].invoice_code || invArray[0].id.slice(0, 8);
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

  const handleDeleteMultiple = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${selectedInvoices.length} hóa đơn đã chọn và toàn bộ dữ liệu liên quan (báo cáo, hoa hồng, gói...)? Thao tác này KHÔNG THỂ HOÀN TÁC.`)) return;

    setIsDeleting(true);
    try {
      for (const invId of selectedInvoices) {
        // 1. Kiểm tra invoice_items để xem có phải hóa đơn bán gói không
        const { data: invItems } = await supabase.from('invoice_items').select('id, type').eq('invoice_id', invId);
        const hasPackageItem = invItems?.some(i => i.type === 'package_sale' || i.type === 'package');

        // 2. Tìm package_sales (Cấu trúc mới)
        const { data: pkgSales } = await supabase.from('package_sales').select('id, customer_package_id').eq('invoice_id', invId);
        
        // --- SAFEGUARD: NGĂN CHẶN XÓA VĨNH VIỄN HÓA ĐƠN CŨ ---
        // Nếu là hóa đơn bán gói nhưng lại KHÔNG CÓ liên kết chuẩn package_sales (Dữ liệu Legacy)
        if (hasPackageItem && (!pkgSales || pkgSales.length === 0)) {
          throw new Error(`Hóa đơn này là dữ liệu cũ (Legacy) thiếu liên kết chuẩn. Để bảo toàn lịch sử hoạt động, vui lòng không "Xóa vĩnh viễn". Hãy bấm vào xem chi tiết và sử dụng nút "Hủy hóa đơn".`);
        }

        let cpIds: string[] = [];

        if (pkgSales && pkgSales.length > 0) {
          const psIds = pkgSales.map(ps => ps.id);
          cpIds = pkgSales.map(ps => ps.customer_package_id).filter(Boolean);
          
          await supabase.from('commission_logs').delete().in('package_sale_id', psIds);
          await supabase.from('revenue_logs').delete().in('package_sale_id', psIds);
          await supabase.from('package_sales').delete().eq('invoice_id', invId);
        }

        if (cpIds.length > 0) {
          await supabase.from('service_sessions').delete().in('customer_package_id', cpIds);
          await supabase.from('revenue_logs').delete().in('reference_id', cpIds);
          await supabase.from('customer_packages').delete().in('id', cpIds);
        }

        // 3. Xoá commission_logs và invoice_items
        if (invItems && invItems.length > 0) {
          const itemIds = invItems.map(i => i.id);
          await supabase.from('commission_logs').delete().in('invoice_item_id', itemIds);
          await supabase.from('invoice_items').delete().eq('invoice_id', invId);
        }

        // 4. Xoá revenue_logs theo invoice_id (bao gồm reference_id cũ)
        await supabase.from('revenue_logs').delete().eq('invoice_id', invId);
        await supabase.from('revenue_logs').delete().eq('reference_id', invId);

        // 4. Xóa hóa đơn
        await supabase.from('invoices').delete().eq('id', invId);

        await supabase.from('audit_logs').insert([{
          shop_id: shopId,
          actor_id: profile?.id,
          action_type: 'HARD_DELETE_INVOICE',
          entity_type: 'INVOICE',
          entity_id: invId,
          description: `Đã XÓA VĨNH VIỄN hóa đơn hệ thống và tất cả dữ liệu liên quan.`
        }]);
      }
      alert('Đã xóa thành công!');
      setSelectedInvoices([]);
      fetchData();
    } catch (error: any) {
      alert('Lỗi trong quá trình xóa: ' + error.message);
    }
    setIsDeleting(false);
  };

  // Removed permission check to allow non-admins to see today's invoices

  return (
    <div className="page-container animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title hidden-mobile">Quản lý Hoá đơn & Phiếu</h1>
          <h1 className="page-title visible-mobile" style={{ fontSize: '1.5rem' }}>Hóa đơn</h1>
          <p className="page-subtitle hidden-mobile">Tra cứu hoá đơn bán hàng và lịch sử trừ buổi</p>
        </div>

        <div className="mobile-stack mobile-search-sticky" style={{ gap: '1rem', flex: 1, justifyContent: 'flex-end' }}>
          {selectedInvoices.length > 0 && view === 'retail' && hasPermission('sale.delete') && (
            <button 
              onClick={handleDeleteMultiple} 
              className="btn" 
              style={{ background: 'var(--danger)', color: 'white', whiteSpace: 'nowrap' }}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="animate-spin" size={18} /> : `Xóa ${selectedInvoices.length} hoá đơn`}
            </button>
          )}
          <div className="premium-card mobile-stack" style={{ flex: 1, position: 'relative', maxWidth: '400px', padding: '0' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Tìm kiếm..." 
              style={{ paddingLeft: '2.75rem', width: '100%', border: 'none', background: 'transparent', height: '44px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {profile?.role === 'shop_admin' && (
        <div style={{ marginBottom: '1rem' }}>
          <div className="mobile-tabs" style={{ marginBottom: dateFilter === 'custom' ? '0.5rem' : '0' }}>
            <button onClick={() => setDateFilter('today')} className="btn mobile-tab" style={{ background: dateFilter === 'today' ? 'var(--primary)' : 'var(--bg-card)', color: dateFilter === 'today' ? 'white' : 'var(--text-primary)', border: '1px solid var(--border)', height: '40px', minWidth: 'auto', padding: '0 1rem' }}>
              Hôm nay
            </button>
            <button onClick={() => setDateFilter('7days')} className="btn mobile-tab" style={{ background: dateFilter === '7days' ? 'var(--primary)' : 'var(--bg-card)', color: dateFilter === '7days' ? 'white' : 'var(--text-primary)', border: '1px solid var(--border)', height: '40px', minWidth: 'auto', padding: '0 1rem' }}>
              7 ngày
            </button>
            <button onClick={() => setDateFilter('month')} className="btn mobile-tab" style={{ background: dateFilter === 'month' ? 'var(--primary)' : 'var(--bg-card)', color: dateFilter === 'month' ? 'white' : 'var(--text-primary)', border: '1px solid var(--border)', height: '40px', minWidth: 'auto', padding: '0 1rem' }}>
              Tháng này
            </button>
            <button onClick={() => setDateFilter('custom')} className="btn mobile-tab" style={{ background: dateFilter === 'custom' ? 'var(--primary)' : 'var(--bg-card)', color: dateFilter === 'custom' ? 'white' : 'var(--text-primary)', border: '1px solid var(--border)', height: '40px', minWidth: 'auto', padding: '0 1rem' }}>
              Tùy chỉnh
            </button>
            <button onClick={() => setDateFilter('all')} className="btn mobile-tab" style={{ background: dateFilter === 'all' ? 'var(--primary)' : 'var(--bg-card)', color: dateFilter === 'all' ? 'white' : 'var(--text-primary)', border: '1px solid var(--border)', height: '40px', minWidth: 'auto', padding: '0 1rem' }}>
              Tất cả
            </button>
          </div>
          {dateFilter === 'custom' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Từ ngày</div>
                <input 
                  type="date" 
                  className="form-input" 
                  value={customStartDate} 
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{ width: '100%', height: '40px', fontSize: '0.875rem' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Đến ngày</div>
                <input 
                  type="date" 
                  className="form-input" 
                  value={customEndDate} 
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{ width: '100%', height: '40px', fontSize: '0.875rem' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mobile-tabs" style={{ marginBottom: '1.5rem' }}>
        <button onClick={() => setView('retail')} className="btn mobile-tab" style={{ background: view === 'retail' ? 'var(--primary)' : 'var(--bg-main)', color: view === 'retail' ? 'white' : 'inherit' }}>
          <FileText size={18} /> Hoá đơn bán hàng
        </button>
        <button onClick={() => setView('session')} className="btn mobile-tab" style={{ background: view === 'session' ? 'var(--primary)' : 'var(--bg-main)', color: view === 'session' ? 'white' : 'inherit' }}>
          <Filter size={18} /> Phiếu dùng liệu trình
        </button>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : view === 'retail' ? (
        <div className="premium-card">
          <div className="desktop-only table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                  <th style={{ width: '40px', padding: '1rem' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedInvoices(filteredInvoices.map(i => i.id));
                        else setSelectedInvoices([]);
                      }}
                    />
                  </th>
                  <th style={{ padding: '1rem' }}>Mã Hoá Đơn</th>
                  <th>Khách hàng</th>
                  <th>Ngày bán</th>
                  <th>Nhân viên / KTV</th>
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
                    <td style={{ padding: '1rem' }} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedInvoices.includes(inv.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedInvoices(prev => [...prev, inv.id]);
                          else setSelectedInvoices(prev => prev.filter(id => id !== inv.id));
                        }}
                      />
                    </td>
                    <td style={{ padding: '1rem', fontWeight: '600' }}>#{inv.invoice_code || '---'}</td>
                    <td>{inv.customer_name || 'Khách lẻ'}</td>
                    <td>{new Date(inv.created_at).toLocaleString()}</td>
                    <td>{inv.real_staff_name || 'Hệ thống'}</td>
                    <td className="financial-cell" style={{ fontWeight: '700', color: 'var(--primary)' }}>{Number(inv.final_amount).toLocaleString()}đ</td>
                    <td>
                      <span className={`badge ${inv.status === 'paid' ? 'badge-success' : inv.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                        {inv.status === 'paid' ? 'Đã thanh toán' : inv.status === 'cancelled' ? 'Đã huỷ' : 'Chờ thanh toán'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>Không có dữ liệu hoá đơn</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mobile-only flex flex-col">
            {filteredInvoices.map(inv => (
              <div 
                key={inv.id} 
                className="invoice-card-compact" 
                onClick={() => handleViewInvoice(inv)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    {inv.customer_name || 'Khách lẻ'}
                  </div>
                  <div style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    #{inv.invoice_code || '---'}
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div className="financial-cell" style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--primary)' }}>
                    {Number(inv.final_amount).toLocaleString()}đ
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    {new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {inv.real_staff_name || 'HT'} • {inv.status === 'paid' ? 'Đã TT' : inv.status === 'cancelled' ? 'Đã huỷ' : 'Chờ TT'}
                  </div>
                </div>
              </div>
            ))}
            {filteredInvoices.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>Không có dữ liệu hoá đơn</div>
            )}
          </div>
        </div>
      ) : (
        <div className="premium-card">
          <div className="hidden-mobile table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
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
                    <td style={{ padding: '1rem', fontWeight: '600', color: 'var(--secondary)' }}>#{sess.session_code || '---'}</td>
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

          <div className="visible-mobile flex flex-col">
            {filteredSessions.map(sess => (
              <div 
                key={sess.id} 
                className="invoice-card-compact" 
                onClick={() => handleViewSession(sess)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    {sess.customer_packages?.customer_name || 'Khách lẻ'}
                  </div>
                  <div style={{ fontWeight: '600', color: 'var(--secondary)', fontSize: '0.875rem' }}>
                    #{sess.session_code || '---'}
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--primary)' }}>
                    {sess.customer_packages?.packages?.name || 'Gói dịch vụ'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    {new Date(sess.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • KTV {sess.profiles?.full_name || 'N/A'} • HT
                  </div>
                </div>
              </div>
            ))}
            {filteredSessions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>Không có phiếu trừ buổi nào</div>
            )}
          </div>
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
                    <span style={{ fontWeight: '600' }}>#{detailModal.data.invoice_code || '---'}</span>
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
                    <span style={{ color: 'var(--text-secondary)' }}>Nhân viên / KTV:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.real_staff_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ngày tạo:</span>
                    <span>{new Date(detailModal.data.created_at).toLocaleString()}</span>
                  </div>

                  {detailModal.data.status === 'cancelled' && (
                    <div style={{ background: 'var(--danger-light)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid var(--danger)' }}>
                      <h4 style={{ color: 'var(--danger)', margin: '0 0 0.5rem 0' }}>HÓA ĐƠN ĐÃ BỊ HỦY</h4>
                      <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>Lý do:</strong> {detailModal.data.cancelled_reason}</p>
                    </div>
                  )}

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
                      <span style={{ textDecoration: detailModal.data.status === 'cancelled' ? 'line-through' : 'none' }}>{Number(detailModal.data.final_amount).toLocaleString()}đ</span>
                    </div>
                  </div>

                  {detailModal.data.status !== 'cancelled' && hasPermission('sale.delete') && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--danger)', marginBottom: '0.5rem' }}>Hủy Hóa Đơn</h4>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="Nhập lý do hủy (Bắt buộc)..."
                          className="form-input"
                          style={{ flex: 1 }}
                          value={cancelReason}
                          onChange={e => setCancelReason(e.target.value)}
                        />
                        <button
                          onClick={handleCancelInvoice}
                          className="btn"
                          style={{ background: 'var(--danger)', color: 'white' }}
                          disabled={isCancelling}
                        >
                          {isCancelling ? <Loader2 className="animate-spin" /> : 'Hủy hóa đơn'}
                        </button>
                      </div>
                      {detailModal.data.is_package_sale && detailModal.data.used_sessions > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.5rem' }}>
                          ⚠️ Gói đã phát sinh sử dụng. Không thể hủy hóa đơn này.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {detailModal.type === 'session' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Mã Phiếu:</span>
                    <span style={{ fontWeight: '600' }}>#{detailModal.data.session_code || '---'}</span>
                  </div>
                  {detailModal.data.original_invoice_code && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Mã hoá đơn (Gốc):</span>
                      <span style={{ fontWeight: '600', color: 'var(--primary)' }}>#{detailModal.data.original_invoice_code}</span>
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
