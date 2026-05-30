import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Loader2,
  FileText,
  Lock,
  Search,
  Info,
  Briefcase
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { TableSkeleton } from '../components/Skeleton';
import { createPortal } from 'react-dom';
import ReportsStaff from '../components/ReportsStaff';

const Reports = () => {
  const { hasPermission, profile } = useAuth();
  const shopId = profile?.shop_id;

  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = getLocalDateString(new Date());
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [missingStaffData, setMissingStaffData] = useState<any[]>([]);
  const isShopAdmin = profile?.role === 'shop_admin';
  const [view, setView] = useState<'revenue' | 'commission' | 'staff'>(isShopAdmin ? 'revenue' : 'staff');
  const [revenueTab, setRevenueTab] = useState<'all' | 'retail' | 'package_sale' | 'package_session'>('all');
  const [revenueDisplayCount, setRevenueDisplayCount] = useState(10);
  const [detailModal, setDetailModal] = useState<any>(null);
  
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalComm: 0,
    totalCashFlow: 0,
    retailRev: 0,
    packageSaleCash: 0,
    totalUnrealizedValue: 0,
    totalUnrealizedSessions: 0
  });

  useEffect(() => {
    if (shopId) fetchReportData();
  }, [shopId]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Check Permissions before fetching
      const canViewRevenue = hasPermission('report.revenue.view');
      const canViewCommissions = hasPermission('report.commission.view');

      let revLog: any[] = [];
      let commLog: any[] = [];

      const [sy, sm, sd] = startDate.split('-').map(Number);
      const startObj = new Date(sy, sm - 1, sd, 0, 0, 0);
      const [ey, em, ed] = endDate.split('-').map(Number);
      const endObj = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      const start = startObj.toISOString();
      const end = endObj.toISOString();

      if (canViewRevenue) {
        const { data, error } = await supabase.from('revenue_logs').select('*').eq('shop_id', shopId).gte('recorded_at', start).lte('recorded_at', end).neq('status', 'cancelled').order('recorded_at', { ascending: false });
        if (error) console.error('Lỗi tải revenue_logs:', error);
        revLog = data || [];
      }

      if (canViewCommissions) {
        const { data: commData, error } = await supabase.from('commission_logs').select('*').eq('shop_id', shopId).gte('created_at', start).lte('created_at', end).neq('status', 'cancelled').order('created_at', { ascending: false });
        
        if (error) {
          console.error('Lỗi tải hoa hồng:', error);
        } else if (commData && commData.length > 0) {
          const staffIds = [...new Set(commData.map(c => c.staff_id).filter(Boolean))];
          let profilesData: any[] = [];
          if (staffIds.length > 0) {
            const { data: profs } = await supabase.from('staffs').select('id, full_name').in('id', staffIds);
            if (profs) profilesData = profs;
          }
          
          commLog = commData.map(c => ({
            ...c,
            staffs: profilesData.find(p => p.id === c.staff_id) || { full_name: 'Nhân viên (Đã xoá)' }
          }));
        }
      }

      // Lấy toàn bộ danh sách nhân viên của shop để map đủ cả những người không có commission_logs
      const { data: allStaffs } = await supabase.from('staffs').select('id, full_name').eq('shop_id', shopId);
      const staffList = allStaffs || [];



      let retailItems: any[] = [];
      
      // Fetch related entities by IDs found in revLog và commLog
      let relatedInvoices: any[] = [];
      let relatedPkgSales: any[] = [];
      let relatedSessions: any[] = [];
      
      const commInvItemIds = [...new Set(commLog.map(c => c.invoice_item_id).filter(Boolean))];
      const commPkgSaleIds = [...new Set(commLog.map(c => c.package_sale_id).filter(Boolean))];
      const commSessionIds = [...new Set(commLog.map(c => c.service_session_id).filter(Boolean))];

      let invIdsToFetch = [...new Set([
        ...revLog.filter((r: any) => r.type === 'retail' || (r.type === 'package_sale' && !r.package_sale_id)).map((r: any) => r.invoice_id || r.reference_id).filter(Boolean)
      ])];
      const psIds = [...new Set([
        ...revLog.filter((r: any) => r.type === 'package_sale' && r.package_sale_id).map((r: any) => r.package_sale_id).filter(Boolean),
        ...commPkgSaleIds
      ])];
      const ssIds = [...new Set([
        ...revLog.filter((r: any) => r.type === 'package_session').map((r: any) => r.service_session_id || r.reference_id).filter(Boolean),
        ...revLog.filter((r: any) => r.type === 'retail').map((r: any) => r.service_session_id).filter(Boolean),
        ...commSessionIds
      ])];

      let commItemsMap: any[] = [];
      if (commInvItemIds.length > 0) {
         const { data: cItems } = await supabase.from('invoice_items').select('id, invoice_id, service_id, package_id').in('id', commInvItemIds);
         if (cItems) {
           commItemsMap = cItems;
           cItems.forEach((ci: any) => { if (ci.invoice_id && !invIdsToFetch.includes(ci.invoice_id)) invIdsToFetch.push(ci.invoice_id); });
         }
      }

      if (psIds.length > 0) {
         const { data: psData } = await supabase.from('package_sales').select('*, invoices(invoice_code), customer_packages(customer_name, card_code)').in('id', psIds);
         if (psData) {
            relatedPkgSales = psData;
            psData.forEach((ps: any) => { if (ps.invoice_id && !invIdsToFetch.includes(ps.invoice_id)) invIdsToFetch.push(ps.invoice_id); });
         }
      }

      if (invIdsToFetch.length > 0) {
         const { data: invs } = await supabase.from('invoices').select('id, invoice_code, customer_id, customer_name').in('id', invIdsToFetch);
         if (invs) {
            relatedInvoices = invs;
            const { data: items } = await supabase.from('invoice_items').select('*').in('invoice_id', invIdsToFetch).eq('type', 'service');
            if (items) retailItems = items;
         }
      }

      if (ssIds.length > 0) {
         const { data: ssData } = await supabase.from('service_sessions').select('*, customer_packages(customer_name, card_code), beds(name)').in('id', ssIds);
         if (ssData) relatedSessions = ssData;
      }

      // Calculations (dùng revLog gốc)
      const retailRev = revLog.filter((r: any) => r.type === 'retail').reduce((acc: number, r: any) => acc + Number(r.amount), 0);
      const packageSessionRev = revLog.filter((r: any) => r.type === 'package_session').reduce((acc: number, r: any) => acc + Number(r.amount), 0);
      const packageSaleCash = revLog.filter((r: any) => r.type === 'package_sale').reduce((acc: number, r: any) => acc + Number(r.amount), 0);

      const totalRev = retailRev + packageSessionRev;
      const totalCashFlow = retailRev + packageSaleCash;
      
      const totalCost = revLog.reduce((acc: number, r: any) => acc + Number(r.cost || 0), 0);
      const totalComm = commLog.reduce((acc: number, c: any) => acc + Number(c.amount), 0);

      // Lấy Nợ dịch vụ (Unrealized revenue) từ customer_packages
      let totalUnrealizedValue = 0;
      let totalUnrealizedSessions = 0;
      const { data: cpData } = await supabase.from('customer_packages').select('total_sessions, used_sessions, sale_price').eq('shop_id', shopId).in('status', ['active', 'pending']);
      if (cpData) {
         cpData.forEach((cp: any) => {
             const remainingSessions = Math.max(0, (cp.total_sessions || 0) - (cp.used_sessions || 0));
             if (remainingSessions > 0 && cp.total_sessions > 0) {
                 const unitPrice = cp.sale_price / cp.total_sessions;
                 totalUnrealizedValue += unitPrice * remainingSessions;
                 totalUnrealizedSessions += remainingSessions;
             }
         });
      }

      setStats({
        totalRevenue: totalRev,
        totalProfit: totalRev - totalCost - totalComm,
        totalComm: totalComm,
        totalCashFlow: totalCashFlow,
        retailRev,
        packageSaleCash,
        totalUnrealizedValue,
        totalUnrealizedSessions
      });

      // Gắn invoice_id và customer_name vào revenue_logs để hiển thị trực tiếp trên danh sách
      const mappedRevLogs = revLog.map((r: any) => {
        let invId: string | null = null;
        let invCode: string | null = null;
        let cName = 'Khách lẻ';
        let sessId: string | null = null;
        let sessCode: string | null = null;
        let cardCode: string | null = null;
        
        if (r.type === 'retail') {
           invId = r.invoice_id || r.reference_id;
           const inv = relatedInvoices.find(i => i.id === invId);
           if (inv) {
               cName = inv.customers?.name || inv.customer_name || 'Khách lẻ';
               invCode = inv.invoice_code || '---';
           }
           if (r.service_session_id) {
               sessId = r.service_session_id;
           }
        } else if (r.type === 'package_sale') {
           if (r.package_sale_id) {
               // Dữ liệu mới (sử dụng package_sale_id chuẩn)
               const ps = relatedPkgSales.find((p: any) => p.id === r.package_sale_id);
               if (ps) {
                 invId = ps.invoice_id;
                 // Ưu tiên lấy invoice_code từ dữ liệu đã fetch hoặc relatedInvoices
                 invCode = ps.invoices?.invoice_code || relatedInvoices.find((i: any) => i.id === invId)?.invoice_code || '---';
                 if (ps.customer_packages) {
                     cName = ps.customer_packages.customer_name || 'Khách thẻ';
                     cardCode = ps.customer_packages.card_code || null;
                 }
               }
           } else if (r.reference_id) {
               // Dữ liệu cũ (reference_id đang lưu invoice_id)
               invId = r.reference_id;
               const inv = relatedInvoices.find(i => i.id === invId);
               if (inv) {
                   cName = inv.customers?.name || inv.customer_name || 'Khách mua thẻ liệu trình';
                   invCode = inv.invoice_code || '---';
               }
           }
        } else if (r.type === 'package_session') {
           sessId = r.service_session_id || r.reference_id;
           const sess = relatedSessions.find(s => s.id === sessId);
           if (sess) {
               sessCode = sess.session_code || '---';
               if (sess.customer_packages) {
                  cName = sess.customer_packages.customer_name || 'Khách thẻ';
                  cardCode = sess.customer_packages.card_code || null;
                  
                  // Tìm invoice gốc thông qua relatedPkgSales hoặc fetch thêm nếu cần
                  const ps = relatedPkgSales.find((p: any) => p.customer_package_id === sess.customer_package_id);
                  if (ps) {
                      invId = ps.invoice_id;
                      const psInv = relatedInvoices.find((i: any) => i.id === invId);
                      invCode = psInv?.invoice_code || '---';
                  }
               }
           }
        }
        
        // Lookup bed name
        let bedName = null;
        if (sessId) {
            const sess = relatedSessions.find(s => s.id === sessId);
            if (sess && sess.beds) {
                bedName = sess.beds.name;
            }
        }

        return { ...r, mapped_invoice_id: invId, mapped_invoice_code: invCode, mapped_session_id: sessId, mapped_session_code: sessCode, card_code: cardCode, customer_name: cName, bed_name: bedName };
      });

      setRevenueData(mappedRevLogs);

      const staffMap: any = {};
      const getStaffName = (id: string) => {
        const s = staffList.find(st => st.id === id);
        return s ? s.full_name : 'Nhân viên (Đã xoá)';
      };

      const ensureStaff = (id: string) => {
        if (!staffMap[id]) staffMap[id] = { id, name: getStaffName(id), execution: 0, sales: 0, logs: [], revenueGenerated: 0 };
      };

      const mappedCommLogs = commLog.map((c: any) => {
        let mappedCode = null;
        let cName = null;

        if (c.service_session_id) {
          const s = relatedSessions.find((x: any) => x.id === c.service_session_id);
          if (s) {
            mappedCode = s.session_code || '---';
            cName = s.retail_customer_name || s.customer_packages?.customer_name;
          }
        } else if (c.package_sale_id) {
          const p = relatedPkgSales.find((x: any) => x.id === c.package_sale_id);
          if (p) {
            const pInv = relatedInvoices.find((x: any) => x.id === p.invoice_id);
            mappedCode = pInv?.invoice_code || '---';
            cName = p.customer_packages?.customer_name;
          }
        } else if (c.invoice_item_id) {
          const ci = commItemsMap.find((x: any) => x.id === c.invoice_item_id);
          if (ci && ci.invoice_id) {
            const inv = relatedInvoices.find((x: any) => x.id === ci.invoice_id);
            if (inv) {
              mappedCode = inv.invoice_code || '---';
              cName = inv.customer_name;
            }
          }
        }
        
        return { ...c, mapped_code: mappedCode, customer_name: cName };
      });

      // Đưa những người có commission_logs vào map
      mappedCommLogs.forEach((c: any) => {
        const id = c.staff_id;
        if (id) {
          ensureStaff(id);
          if (c.type === 'service_execution') staffMap[id].execution += Number(c.amount);
          if (c.type === 'package_sale' || c.type === 'retail') staffMap[id].sales += Number(c.amount);
          staffMap[id].logs.push(c);
        }
      });
      // Tính doanh số thực thu từ package_sales và retail dựa trên revenue_logs
      revLog.forEach((r: any) => {
        if (r.type === 'package_sale') {
           const ps = relatedPkgSales.find((p: any) => p.id === r.package_sale_id);
           if (ps && ps.seller_id) {
               ensureStaff(ps.seller_id);
               staffMap[ps.seller_id].revenueGenerated += Number(r.amount);
           }
        } else if (r.type === 'retail') {
           const ss = relatedSessions.find((s: any) => s.id === r.service_session_id);
           if (ss && ss.staff_id) {
               ensureStaff(ss.staff_id);
               staffMap[ss.staff_id].revenueGenerated += Number(r.amount);
           }
        }
      });

      // Lọc ra nhân viên CÓ PHÁT SINH dữ liệu (để không hiện những người ko làm gì)
      const activeStaffData = Object.values(staffMap).filter((s: any) => 
        s.execution > 0 || s.sales > 0 || s.revenueGenerated > 0 || s.logs.length > 0
      );

      setStaffData(activeStaffData);

      // Thống kê các giao dịch không có kỹ thuật viên/người bán (mồ côi)
      const missingTransactions: any[] = [];
      relatedPkgSales.forEach(ps => {
        if (!ps.seller_id) missingTransactions.push({ id: ps.id, type: 'Bán gói', amount: ps.amount_paid, date: ps.created_at });
      });
      retailItems.forEach(ri => {
        if (!ri.staff_id) missingTransactions.push({ id: ri.id, type: 'Dịch vụ lẻ', amount: ri.final_price || ri.price, date: relatedInvoices.find(i=>i.id === ri.invoice_id)?.created_at || new Date().toISOString() });
      });
      relatedSessions.forEach(ss => {
        if (!ss.staff_id) missingTransactions.push({ id: ss.id, type: 'Trừ buổi', amount: ss.revenue_amount, date: ss.created_at });
      });
      setMissingStaffData(missingTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const openRevenueDetail = async (log: any) => {
    setLoading(true);
    try {
      const resolveItemNames = async (itemList: any[]) => {
        for (let i = 0; i < itemList.length; i++) {
          if (!itemList[i].name) {
            if (itemList[i].type === 'service' && itemList[i].service_id) {
              const { data: svc } = await supabase.from('services').select('name').eq('id', itemList[i].service_id).single();
              if (svc) itemList[i].name = svc.name;
            } else if ((itemList[i].type === 'package' || itemList[i].type === 'package_sale') && itemList[i].package_id) {
              const { data: pkg } = await supabase.from('packages').select('name').eq('id', itemList[i].package_id).single();
              if (pkg) itemList[i].name = pkg.name;
            }
          }
        }
        return itemList;
      };

      if (log.type === 'retail') {
        const idToLook = log.invoice_id || log.reference_id;
        const { data: inv } = await supabase.from('invoices').select('*').eq('id', idToLook).single();
        const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', idToLook);
        
        let staffName = 'Thu ngân';
        if (log.service_session_id) {
          const { data: sess } = await supabase.from('service_sessions').select('staff_id').eq('id', log.service_session_id).single();
          if (sess && sess.staff_id) {
            const { data: stf } = await supabase.from('staffs').select('full_name').eq('id', sess.staff_id).single();
            if (stf) staffName = stf.full_name;
          }
        } else if (inv?.created_by) {
          const { data: staff } = await supabase.from('profiles').select('full_name').eq('id', inv.created_by).single();
          if (staff) staffName = staff.full_name;
        }

        setDetailModal({ 
          type: 'invoice', 
          data: { ...inv, staff_name: staffName, items: await resolveItemNames(items || []) }, 
          title: `Hoá đơn #${inv?.invoice_code || '---'}` 
        });
      } else if (log.type === 'package_sale') {
        const idToLook = log.package_sale_id || log.reference_id;
        const { data: sale } = await supabase.from('package_sales').select('*').eq('id', idToLook).single();
        if (sale && sale.customer_package_id) {
          const { data: cp } = await supabase.from('customer_packages').select('*').eq('id', sale.customer_package_id).single();
          const { data: prof } = sale.seller_id ? await supabase.from('staffs').select('full_name').eq('id', sale.seller_id).single() : { data: null };
          if (cp) {
            const { data: pkg } = await supabase.from('packages').select('name').eq('id', cp.package_id).single();
            const { data: inv } = sale.invoice_id ? await supabase.from('invoices').select('invoice_code').eq('id', sale.invoice_id).single() : { data: null };
            setDetailModal({ 
              type: 'package_sale', 
              data: { ...sale, customer: cp, packageName: pkg?.name || 'Gói không xác định', staff_name: prof?.full_name || 'Thu ngân / Người bán', invoice_code: inv?.invoice_code }, 
              title: inv?.invoice_code ? `Chi tiết Bán liệu trình #${inv.invoice_code}` : `Chi tiết Bán liệu trình`
            });
            return;
          }
        }
        setDetailModal({ type: 'deleted_record', data: log, title: `Chi tiết Bán liệu trình (Đã xoá)` });
      } else if (log.type === 'package_session' || log.type === 'service_execution' || (!log.type && log.service_session_id) || log.type === 'retail') {
        const idToLook = log.service_session_id || log.reference_id;
        
        if (!idToLook) {
          if (log.invoice_item_id) {
            const { data: invItem } = await supabase.from('invoice_items').select('invoice_id').eq('id', log.invoice_item_id).single();
            if (invItem && invItem.invoice_id) {
               const { data: inv } = await supabase.from('invoices').select('*').eq('id', invItem.invoice_id).single();
               const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invItem.invoice_id);
               const { data: staff } = inv?.created_by ? await supabase.from('profiles').select('full_name').eq('id', inv.created_by).single() : { data: null };
               setDetailModal({ 
                 type: 'invoice', 
                 data: { ...inv, staff_name: staff?.full_name || 'Thu ngân', items: await resolveItemNames(items || []) }, 
                 title: `Hoá đơn #${inv?.invoice_code || '---'}` 
               });
               return;
            }
          } else if (log.invoice_id) {
               const { data: inv } = await supabase.from('invoices').select('*').eq('id', log.invoice_id).single();
               const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', log.invoice_id);
               const { data: staff } = inv?.created_by ? await supabase.from('profiles').select('full_name').eq('id', inv.created_by).single() : { data: null };
               setDetailModal({ 
                 type: 'invoice', 
                 data: { ...inv, staff_name: staff?.full_name || 'Thu ngân', items: await resolveItemNames(items || []) }, 
                 title: `Hoá đơn #${inv?.invoice_code || '---'}` 
               });
               return;
          }
          setDetailModal({ type: 'deleted_record', data: log, title: `Chi tiết Dịch vụ (Đã xoá)` });
          return;
        }

        const { data: sess } = await supabase.from('service_sessions').select('*').eq('id', idToLook).single();
        if (sess) {
           const { data: prof } = sess.staff_id ? await supabase.from('staffs').select('full_name').eq('id', sess.staff_id).single() : { data: null };
           const { data: svc } = sess.service_id ? await supabase.from('services').select('name').eq('id', sess.service_id).single() : { data: null };
           if (svc) sess.services = svc;
           
           if (sess.is_retail || !sess.customer_package_id) {
             setDetailModal({ 
                type: 'retail_session', 
                data: { ...sess, staff_name: prof?.full_name || 'Kỹ thuật viên' }, 
                title: `Chi tiết Thực hiện dịch vụ (Lẻ)` 
             });
             return;
           } else {
             const { data: cp } = await supabase.from('customer_packages').select('*').eq('id', sess.customer_package_id).single();
             if (cp) {
               const { data: pkg } = await supabase.from('packages').select('name').eq('id', cp.package_id).single();
               setDetailModal({ 
                 type: 'package_session', 
                 data: { ...sess, customer: cp, packageName: pkg?.name || 'Gói không xác định', staff_name: prof?.full_name || 'Kỹ thuật viên' }, 
                 title: `Chi tiết Trừ buổi liệu trình` 
               });
               return;
             }
           }
        } else {
           setDetailModal({ 
             type: 'deleted_record', 
             data: log, 
             title: `Chi tiết Thực hiện dịch vụ (Đã xoá)` 
           });
           return;
        }
        
        setDetailModal({ type: 'generic', data: sess || log || { message: 'Không tìm thấy dữ liệu' }, title: `Chi tiết Thực hiện dịch vụ` });
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !detailModal) return (
    <div className="page-container animate-fade">
      <TableSkeleton />
    </div>
  );

  return (
    <div className="page-container animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Báo cáo Tổng hợp</h1>
          <p className="page-subtitle">Theo dõi dòng tiền, doanh thu và hiệu suất</p>
        </div>
        
        {isShopAdmin && (
          <div className="mobile-stack" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', flex: 1 }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Từ:</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: '500', width: '100%' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', flex: 1 }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Đến:</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: '500', width: '100%' }} />
            </div>
            <button onClick={fetchReportData} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
              <Search size={16} /> Tìm kiếm
            </button>
          </div>
        )}
        {!isShopAdmin && (
          <div style={{ background: 'var(--bg-main)', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
            Hôm nay: {new Date().toLocaleDateString('vi-VN')}
          </div>
        )}
      </div>

      {isShopAdmin && (
        <div className="mobile-tabs" style={{ marginBottom: '1.5rem' }}>
          <button onClick={() => setView('revenue')} className="btn mobile-tab" style={{ background: view === 'revenue' ? 'var(--primary)' : 'var(--bg-main)', color: view === 'revenue' ? 'white' : 'inherit' }}>
            <TrendingUp size={18} /> Doanh thu
          </button>
          <button onClick={() => setView('commission')} className="btn mobile-tab" style={{ background: view === 'commission' ? 'var(--primary)' : 'var(--bg-main)', color: view === 'commission' ? 'white' : 'inherit' }}>
            <Users size={18} /> Hoa hồng (Chi tiết)
          </button>
          <button onClick={() => setView('staff')} className="btn mobile-tab" style={{ background: view === 'staff' ? 'var(--primary)' : 'var(--bg-main)', color: view === 'staff' ? 'white' : 'inherit' }}>
            <Briefcase size={18} /> Báo cáo nhân viên
          </button>
        </div>
      )}
      
      {view === 'revenue' && (
        <>
          {hasPermission('report.revenue.view') ? (
            <>
              <div className="kpi-grid" style={{ marginBottom: '2rem' }}>
                <div className="premium-card" style={{ borderLeft: '4px solid var(--secondary)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tiền thu vào (Tổng Cashflow)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{stats.totalCashFlow.toLocaleString()}đ</div>
                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Thu dịch vụ lẻ:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{stats.retailRev.toLocaleString()}đ</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Thu bán liệu trình:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{stats.packageSaleCash.toLocaleString()}đ</strong>
                    </div>
                  </div>
                </div>

                <div className="premium-card" style={{ borderLeft: '4px solid var(--primary)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Doanh thu đã thực hiện
                    <span title="Doanh thu chỉ được ghi nhận khi khách sử dụng dịch vụ." style={{ cursor: 'help', color: 'var(--primary)', display: 'inline-flex' }}>
                      <Info size={14} />
                    </span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{stats.totalRevenue.toLocaleString()}đ</div>
                </div>

                <div className="premium-card" style={{ borderLeft: '4px solid var(--success)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Lợi nhuận vận hành</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{stats.totalProfit.toLocaleString()}đ</div>
                </div>

                <div className="premium-card" style={{ borderLeft: '4px solid var(--warning)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Nợ dịch vụ còn lại</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{Math.round(stats.totalUnrealizedValue).toLocaleString()}đ</div>
                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)', fontSize: '0.75rem', color: 'var(--warning)', fontWeight: '600' }}>
                    Khách còn {stats.totalUnrealizedSessions} buổi chưa dùng
                  </div>
                </div>
              </div>

              <div className="premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={20} /> Nhật ký Doanh thu</h3>
                </div>

                {/* Sub-tabs cho Doanh thu */}
                <div className="mobile-tabs" style={{ marginBottom: '1.5rem' }}>
                  <button onClick={() => { setRevenueTab('all'); setRevenueDisplayCount(10); }} className="btn mobile-tab" style={{ background: revenueTab === 'all' ? 'var(--primary)' : 'var(--bg-main)', color: revenueTab === 'all' ? 'white' : 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.875rem' }}>Tất cả</button>
                  <button onClick={() => { setRevenueTab('retail'); setRevenueDisplayCount(10); }} className="btn mobile-tab" style={{ background: revenueTab === 'retail' ? 'var(--primary)' : 'var(--bg-main)', color: revenueTab === 'retail' ? 'white' : 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.875rem' }}>Dịch vụ lẻ</button>
                  <button onClick={() => { setRevenueTab('package_sale'); setRevenueDisplayCount(10); }} className="btn mobile-tab" style={{ background: revenueTab === 'package_sale' ? 'var(--primary)' : 'var(--bg-main)', color: revenueTab === 'package_sale' ? 'white' : 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.875rem' }}>Bán liệu trình</button>
                  <button onClick={() => { setRevenueTab('package_session'); setRevenueDisplayCount(10); }} className="btn mobile-tab" style={{ background: revenueTab === 'package_session' ? 'var(--primary)' : 'var(--bg-main)', color: revenueTab === 'package_session' ? 'white' : 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.875rem' }}>Sử dụng liệu trình (Trừ buổi)</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {revenueData.filter(r => revenueTab === 'all' || r.type === revenueTab).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)', background: 'var(--bg-main)', borderRadius: '0.75rem' }}>
                      Không có phát sinh doanh thu loại này.
                    </div>
                  ) : (
                    <>
                      {revenueData.filter(r => revenueTab === 'all' || r.type === revenueTab).slice(0, revenueDisplayCount).map((r, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => openRevenueDetail(r)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s', borderRadius: '0.75rem', background: 'var(--bg-main)' }}
                          onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: r.type === 'retail' ? 'rgba(59, 130, 246, 0.1)' : r.type === 'package_sale' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: r.type === 'retail' ? '#3b82f6' : r.type === 'package_sale' ? 'var(--secondary)' : '#10b981' }}>
                              <FileText size={20} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>
                                {r.type === 'retail' ? 'Thu dịch vụ lẻ' : r.type === 'package_sale' ? 'Thu bán thẻ liệu trình' : 'Trừ buổi liệu trình'} 
                                
                                {/* Mã hóa đơn cho cả 3 loại */}
                                {r.mapped_invoice_code ? <span style={{ color: 'var(--primary)', marginLeft: '0.25rem' }}>HĐ: #{r.mapped_invoice_code}</span> : ''}
                                
                                {/* Mã thẻ liệu trình cho Bán liệu trình và Trừ buổi */}
                                {r.card_code && (r.type === 'package_sale' || r.type === 'package_session') ? <span style={{ color: 'var(--warning)', marginLeft: '0.25rem' }}>Thẻ: {r.card_code}</span> : ''}
                                
                                {/* Mã phiếu trừ buổi riêng cho Sử dụng liệu trình */}
                                {r.type === 'package_session' && r.mapped_session_code ? <span style={{ color: 'var(--success)', marginLeft: '0.25rem' }}>Phiếu: #{r.mapped_session_code}</span> : ''}

                                {/* Hiển thị chỗ/giường */}
                                {r.bed_name ? <span style={{ color: 'var(--secondary)', marginLeft: '0.5rem', background: 'rgba(109, 40, 217, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.75rem' }}>{r.bed_name}</span> : ''}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>{r.customer_name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--border)' }}>•</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(r.recorded_at).toLocaleString('vi-VN')}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <strong style={{ fontSize: '1.1rem', color: r.type === 'package_session' ? 'var(--primary)' : 'var(--success)' }}>
                              +{Number(r.amount).toLocaleString()}đ
                            </strong>
                          </div>
                        </div>
                      ))}
                      
                      {revenueData.filter(r => revenueTab === 'all' || r.type === revenueTab).length > revenueDisplayCount && (
                        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                          <button 
                            onClick={() => setRevenueDisplayCount(prev => prev + 10)}
                            className="btn" 
                            style={{ background: 'var(--bg-main)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '2rem', padding: '0.5rem 2rem', fontWeight: '600', fontSize: '0.875rem' }}
                          >
                            Xem thêm
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="premium-card" style={{ textAlign: 'center', padding: '5rem' }}>
              <Lock size={48} style={{ color: 'var(--text-light)', marginBottom: '1rem' }} />
              <h3>Bạn không có quyền xem báo cáo doanh thu</h3>
            </div>
          )}
        </>
      )}

      {view === 'commission' && (
        <>
          {hasPermission('report.commission.view') ? (
            <>
              <div className="grid grid-cols-1" style={{ marginBottom: '2rem' }}>
                <div className="premium-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tổng Hoa hồng chi trả</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem', color: 'var(--warning)' }}>{stats.totalComm.toLocaleString()}đ</div>
                </div>
              </div>

              <div className="premium-card">
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}><Users size={20} /> Chi tiết Hoa hồng Nhân viên</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {staffData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)', background: 'var(--bg-main)', borderRadius: '1rem' }}>
                      Không có dữ liệu hoa hồng trong khoảng thời gian này
                    </div>
                  ) : (
                    staffData.map(s => (
                      <div key={s.id} style={{ background: 'var(--bg-main)', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                          <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '0.5rem' }}>{s.name}</h3>
                            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                              <span>Thực hiện: <strong>{s.execution.toLocaleString()}đ</strong></span>
                              <span>Bán hàng: <strong>{s.sales.toLocaleString()}đ</strong></span>
                              <span style={{ color: 'var(--success)' }}>Doanh số Thực thu: <strong>{Number(s.revenueGenerated || 0).toLocaleString()}đ</strong></span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tổng hoa hồng</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{(s.execution + s.sales).toLocaleString()}đ</div>
                          </div>
                        </div>

                        <div className="desktop-only table-responsive">
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: '600px' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '0.75rem 0.5rem', width: '20%' }}>Ngày/Giờ</th>
                              <th style={{ padding: '0.75rem 0.5rem', width: '30%' }}>Nghiệp vụ / Dịch vụ</th>
                              <th style={{ padding: '0.75rem 0.5rem', width: '20%' }}>Mã Phiếu/HĐ</th>
                              <th style={{ padding: '0.75rem 0.5rem', width: '15%' }}>Loại</th>
                              <th style={{ padding: '0.75rem 0.5rem', width: '15%', textAlign: 'right' }}>Hoa hồng nhận</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.logs.map((log: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.75rem 0.5rem' }}>{new Date(log.created_at).toLocaleString()}</td>
                                <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>{log.note || 'Thực hiện dịch vụ'}</td>
                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                  <button 
                                    onClick={() => openRevenueDetail(log)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                  >
                                    #{log.mapped_code || '---'}
                                    {!log.mapped_code && <span style={{fontSize: '0.7rem', color: 'var(--danger)', marginLeft: '0.25rem'}}>(Đã xoá)</span>}
                                    <FileText size={12} />
                                  </button>
                                </td>
                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                  <span className={`badge ${log.type === 'package_sale' || log.type === 'retail' ? 'badge-primary' : 'badge-success'}`}>
                                    {log.type === 'package_sale' || log.type === 'retail' ? 'Bán hàng' : 'Thực hiện'}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>
                                  +{Number(log.amount).toLocaleString()}đ
                                </td>
                              </tr>
                            ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mobile-only flex flex-col" style={{ gap: '0.75rem', marginTop: '1rem' }}>
                          {s.logs.map((log: any, idx: number) => (
                            <div key={idx} style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <div style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{log.note || 'Thực hiện dịch vụ'}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(log.created_at).toLocaleString()}</div>
                                </div>
                                <span className={`badge ${log.type === 'package_sale' || log.type === 'retail' ? 'badge-primary' : 'badge-success'}`}>
                                  {log.type === 'package_sale' || log.type === 'retail' ? 'Bán hàng' : 'Thực hiện'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', borderTop: '1px dashed var(--border)', paddingTop: '0.5rem' }}>
                                <button 
                                  onClick={() => openRevenueDetail(log)}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}
                                >
                                  #{log.mapped_code || '---'}
                                  {!log.mapped_code && <span style={{fontSize: '0.7rem', color: 'var(--danger)', marginLeft: '0.25rem'}}>(Đã xoá)</span>}
                                  <FileText size={12} />
                                </button>
                                <div style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '1.1rem' }}>
                                  +{Number(log.amount).toLocaleString()}đ
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Phần hiển thị Giao dịch mồ côi (không gán KTV) */}
                  {missingStaffData.length > 0 && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', borderRadius: '0.75rem', padding: '1.5rem', border: '1px dashed var(--danger)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px dashed rgba(239, 68, 68, 0.3)', paddingBottom: '1rem' }}>
                        <div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--danger)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Lock size={18} /> Giao dịch chưa gán Kỹ thuật viên / Người bán
                          </h3>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Những giao dịch này bị bỏ trống người thực hiện lúc thanh toán. Bạn cần gán lại trên hóa đơn để tính hoa hồng.
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--danger)', textTransform: 'uppercase' }}>Số lượng giao dịch</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--danger)' }}>{missingStaffData.length}</div>
                        </div>
                      </div>
                      <div className="desktop-only table-responsive">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: '600px' }}>
                          <thead>
                            <tr style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', borderRadius: '0.5rem 0 0 0.5rem' }}>Ngày/Giờ</th>
                              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Loại giao dịch</th>
                              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Mã phiếu/HĐ</th>
                              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', borderRadius: '0 0.5rem 0.5rem 0' }}>Doanh số</th>
                            </tr>
                          </thead>
                          <tbody>
                            {missingStaffData.map((m: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <td style={{ padding: '0.75rem 0.5rem' }}>{new Date(m.date).toLocaleString()}</td>
                                <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>{m.type}</td>
                                <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>#{m.mapped_invoice_code || m.mapped_session_code || '---'}</td>
                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--danger)' }}>
                                  {Number(m.amount).toLocaleString()}đ
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mobile-only flex flex-col" style={{ gap: '0.75rem', marginTop: '1rem' }}>
                        {missingStaffData.map((m: any, idx: number) => (
                          <div key={idx} style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{m.type}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(m.date).toLocaleString()}</div>
                              </div>
                              <div style={{ fontWeight: '700', color: 'var(--danger)', fontSize: '1.1rem' }}>
                                {Number(m.amount).toLocaleString()}đ
                              </div>
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'monospace', borderTop: '1px dashed rgba(239, 68, 68, 0.3)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                               Mã phiếu: #{m.mapped_invoice_code || m.mapped_session_code || '---'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </>
          ) : (
            <div className="premium-card" style={{ textAlign: 'center', padding: '5rem' }}>
              <Lock size={48} style={{ color: 'var(--text-light)', marginBottom: '1rem' }} />
              <h3>Bạn không có quyền xem báo cáo hoa hồng</h3>
            </div>
          )}
        </>
      )}

      {view === 'staff' && (
        <ReportsStaff shopId={shopId || ''} startDate={startDate} endDate={endDate} />
      )}

      {/* DETAIL MODAL */}
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
                    <span style={{ color: 'var(--text-secondary)' }}>Khách hàng:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer_name || 'Khách lẻ'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Nhân viên:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.staff_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ngày tạo:</span>
                    <span>{new Date(detailModal.data.created_at).toLocaleString()}</span>
                  </div>
                  
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Sản phẩm / Dịch vụ</h4>
                  <div style={{ background: 'var(--bg-main)', borderRadius: '0.5rem', padding: '1rem' }}>
                    {detailModal.data.items?.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span>{item.name || item.service_name || 'Dịch vụ'}</span>
                        <span>{Number(item.price || item.unit_price).toLocaleString()}đ</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: 'var(--primary)', fontSize: '1.1rem' }}>
                      <span>Tổng cộng:</span>
                      <span>{Number(detailModal.data.final_amount).toLocaleString()}đ</span>
                    </div>
                  </div>
                </div>
              )}

              {detailModal.type === 'staff_comm' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1, background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Thực hiện</div>
                      <div style={{ fontWeight: '700' }}>{Number(detailModal.data.execution).toLocaleString()}đ</div>
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Bán gói</div>
                      <div style={{ fontWeight: '700' }}>{Number(detailModal.data.sales).toLocaleString()}đ</div>
                    </div>
                  </div>
                  
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Chi tiết các lượt ({detailModal.data.logs.length})</h4>
                  {detailModal.data.logs.map((c: any, idx: number) => (
                    <div key={idx} style={{ padding: '0.75rem', background: 'var(--bg-main)', borderRadius: '0.5rem', borderLeft: c.type === 'package_sale' ? '3px solid var(--secondary)' : '3px solid var(--primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{c.type === 'package_sale' ? 'Bán liệu trình' : 'Dùng liệu trình'}</span>
                        <span style={{ color: 'var(--primary)', fontWeight: '700' }}>+{Number(c.amount).toLocaleString()}đ</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{c.note || 'N/A'}</span>
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {detailModal.type === 'package_sale' && (
                <div>
                  {detailModal.data.invoice_id && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Mã Hóa Đơn:</span>
                      <span style={{ fontWeight: '600', color: 'var(--primary)' }}>#{detailModal.data.invoice_code || '---'}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Khách hàng:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer?.customer_name || 'Khách lẻ'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Số điện thoại:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer?.customer_phone}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Mã thẻ:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer?.card_code || 'Không có'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Nhân viên:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.staff_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ngày mua:</span>
                    <span>{new Date(detailModal.data.created_at).toLocaleString()}</span>
                  </div>
                  
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Sản phẩm / Dịch vụ</h4>
                  <div style={{ background: 'var(--bg-main)', borderRadius: '0.5rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span>Gói: {detailModal.data.packageName}</span>
                      <span>{Number(detailModal.data.amount_paid).toLocaleString()}đ</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <span>Tổng số buổi:</span>
                      <span>{detailModal.data.customer?.total_sessions} buổi</span>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: 'var(--primary)', fontSize: '1.1rem' }}>
                      <span>Tổng thanh toán:</span>
                      <span>{Number(detailModal.data.amount_paid).toLocaleString()}đ</span>
                    </div>
                  </div>
                </div>
              )}

              {detailModal.type === 'package_session' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Khách hàng:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer?.customer_name || 'Khách lẻ'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Số điện thoại:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer?.customer_phone}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Mã thẻ:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer?.card_code || 'Không có'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Nhân viên:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.staff_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ngày dùng:</span>
                    <span>{new Date(detailModal.data.created_at).toLocaleString()}</span>
                  </div>
                  
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Sản phẩm / Dịch vụ</h4>
                  <div style={{ background: 'var(--bg-main)', borderRadius: '0.5rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span>Trừ 1 buổi: {detailModal.data.packageName}</span>
                      <span>-</span>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      <span>Tổng số buổi gói:</span>
                      <span>{detailModal.data.customer?.total_sessions} buổi</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      <span>Đã sử dụng:</span>
                      <span>{detailModal.data.customer?.used_sessions} buổi</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: 'var(--primary)', marginTop: '0.5rem' }}>
                      <span>Còn lại:</span>
                      <span>{detailModal.data.customer?.total_sessions - detailModal.data.customer?.used_sessions} buổi</span>
                    </div>
                  </div>
                </div>
              )}

              {detailModal.type === 'retail_session' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Mã Phiếu:</span>
                    <span style={{ fontWeight: '600', color: 'var(--primary)' }}>#{detailModal.data.session_code || '---'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Dịch vụ:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.services?.name || 'Dịch vụ lẻ'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Khách hàng:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.retail_customer_name || 'Khách lẻ'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Nhân viên:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.staff_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ngày dùng:</span>
                    <span>{new Date(detailModal.data.created_at).toLocaleString()}</span>
                  </div>
                  
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Tài chính</h4>
                  <div style={{ background: 'var(--bg-main)', borderRadius: '0.5rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span>Doanh thu tính HH:</span>
                      <span>{Number(detailModal.data.revenue_amount).toLocaleString()}đ</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: 'var(--primary)', marginTop: '0.5rem' }}>
                      <span>Hoa hồng nhận:</span>
                      <span>{Number(detailModal.data.commission_amount).toLocaleString()}đ</span>
                    </div>
                  </div>
                </div>
              )}

              {detailModal.type === 'deleted_record' && (
                <div>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Lock size={18} /> Dữ liệu gốc đã bị xoá khỏi hệ thống.
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Mã tham chiếu:</span>
                    <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>Dữ liệu hệ thống</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Nội dung:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.note || 'Thực hiện dịch vụ'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ngày ghi nhận:</span>
                    <span>{new Date(detailModal.data.created_at).toLocaleString()}</span>
                  </div>
                  
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Tài chính</h4>
                  <div style={{ background: 'var(--bg-main)', borderRadius: '0.5rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: 'var(--primary)' }}>
                      <span>Hoa hồng nhận:</span>
                      <span>{Number(detailModal.data.amount).toLocaleString()}đ</span>
                    </div>
                  </div>
                </div>
              )}

              {detailModal.type === 'generic' && (
                <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.875rem', whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                  {JSON.stringify(detailModal.data, null, 2)}
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

export default Reports;
