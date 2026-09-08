import { supabase } from './supabase';

/**
 * Hàm làm giàu dữ liệu doanh thu thật (dùng chung cho Reports.tsx và posaAutoSyncService.ts)
 * 
 * Chuẩn schema đã được xác thực:
 * - service_sessions: KHÔNG query invoice_id
 * - invoice_items: KHÔNG query quantity
 */
export const enrichRealRevenueLogs = async (rawLogs: any[]): Promise<any[]> => {
  if (!rawLogs || rawLogs.length === 0) return [];

  const sessionIds: string[] = [];
  const packageSaleIds: string[] = [];
  const invoiceIds: string[] = [];

  for (const r of rawLogs) {
    const sId = r.service_session_id || (r.type === 'package_session' ? r.reference_id : null);
    if (sId && !sessionIds.includes(sId)) sessionIds.push(sId);

    const psId = r.package_sale_id || (r.type === 'package_sale' ? r.reference_id : null);
    if (psId && !packageSaleIds.includes(psId)) packageSaleIds.push(psId);

    const invId = r.invoice_id || (r.type === 'retail' || r.type === 'combo' ? r.reference_id : null);
    if (invId && !invoiceIds.includes(invId)) invoiceIds.push(invId);
  }

  // 1. Batch fetch tầng 1: service_sessions, package_sales, invoices, invoice_items
  const [sessionsRes, packageSalesRes, invoicesRes, invoiceItemsRes] = await Promise.all([
    sessionIds.length > 0
      ? supabase.from('service_sessions').select('id, session_code, service_id, staff_id, customer_package_id').in('id', sessionIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    packageSaleIds.length > 0
      ? supabase.from('package_sales').select('id, invoice_id, seller_id, customer_package_id').in('id', packageSaleIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    invoiceIds.length > 0
      ? supabase.from('invoices').select('id, invoice_code, customer_name, created_by').in('id', invoiceIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    invoiceIds.length > 0
      ? supabase.from('invoice_items').select('id, invoice_id, service_id, package_id, price, unit_price').in('invoice_id', invoiceIds)
      : Promise.resolve({ data: [] as any[], error: null })
  ]);

  if (sessionsRes.error) console.error('[enrichRealRevenueLogs] Lỗi truy vấn service_sessions:', sessionsRes.error);
  if (packageSalesRes.error) console.error('[enrichRealRevenueLogs] Lỗi truy vấn package_sales:', packageSalesRes.error);
  if (invoicesRes.error) console.error('[enrichRealRevenueLogs] Lỗi truy vấn invoices:', invoicesRes.error);
  if (invoiceItemsRes.error) console.error('[enrichRealRevenueLogs] Lỗi truy vấn invoice_items:', invoiceItemsRes.error);

  const sessions: any[] = sessionsRes.data || [];
  const packageSales: any[] = packageSalesRes.data || [];
  const invoices: any[] = invoicesRes.data || [];
  const invoiceItems: any[] = invoiceItemsRes.data || [];

  // Tìm thêm invoice nếu package_sale có invoice_id mà chưa có trong danh sách
  const extraInvoiceIds: string[] = [];
  for (const ps of packageSales) {
    if (ps.invoice_id && !invoiceIds.includes(ps.invoice_id) && !extraInvoiceIds.includes(ps.invoice_id)) {
      extraInvoiceIds.push(ps.invoice_id);
    }
  }
  if (extraInvoiceIds.length > 0) {
    const { data: extraInvs, error: extraInvsErr } = await supabase
      .from('invoices')
      .select('id, invoice_code, customer_name, created_by')
      .in('id', extraInvoiceIds);
    if (extraInvsErr) console.error('[enrichRealRevenueLogs] Lỗi truy vấn extra invoices:', extraInvsErr);
    if (extraInvs) invoices.push(...extraInvs);
  }

  // 2. Thu thập IDs tầng 2: staffs, services, packages, customer_packages
  const staffIds: string[] = [];
  const serviceIds: string[] = [];
  const packageIds: string[] = [];
  const custPkgIds: string[] = [];

  for (const s of sessions) {
    if (s.staff_id && !staffIds.includes(s.staff_id)) staffIds.push(s.staff_id);
    if (s.service_id && !serviceIds.includes(s.service_id)) serviceIds.push(s.service_id);
    if (s.customer_package_id && !custPkgIds.includes(s.customer_package_id)) custPkgIds.push(s.customer_package_id);
  }

  for (const ps of packageSales) {
    if (ps.seller_id && !staffIds.includes(ps.seller_id)) staffIds.push(ps.seller_id);
    if (ps.customer_package_id && !custPkgIds.includes(ps.customer_package_id)) custPkgIds.push(ps.customer_package_id);
  }

  for (const it of invoiceItems) {
    if (it.service_id && !serviceIds.includes(it.service_id)) serviceIds.push(it.service_id);
    if (it.package_id && !packageIds.includes(it.package_id)) packageIds.push(it.package_id);
  }

  // 3. Batch fetch tầng 2
  const [staffsRes, servicesRes, packagesRes, custPkgsRes] = await Promise.all([
    staffIds.length > 0
      ? supabase.from('staffs').select('id, full_name').in('id', staffIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    serviceIds.length > 0
      ? supabase.from('services').select('id, name, price').in('id', serviceIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    packageIds.length > 0
      ? supabase.from('packages').select('id, name').in('id', packageIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    custPkgIds.length > 0
      ? supabase.from('customer_packages').select('id, package_id, customer_name, card_code').in('id', custPkgIds)
      : Promise.resolve({ data: [] as any[], error: null })
  ]);

  if (staffsRes.error) console.error('[enrichRealRevenueLogs] Lỗi truy vấn staffs:', staffsRes.error);
  if (servicesRes.error) console.error('[enrichRealRevenueLogs] Lỗi truy vấn services:', servicesRes.error);
  if (packagesRes.error) console.error('[enrichRealRevenueLogs] Lỗi truy vấn packages:', packagesRes.error);
  if (custPkgsRes.error) console.error('[enrichRealRevenueLogs] Lỗi truy vấn customer_packages:', custPkgsRes.error);

  const staffs: any[] = staffsRes.data || [];
  const services: any[] = servicesRes.data || [];
  const packages: any[] = packagesRes.data || [];
  const custPkgs: any[] = custPkgsRes.data || [];

  // Tìm thêm packages từ customer_packages nếu chưa có
  const extraPkgIds: string[] = [];
  for (const cp of custPkgs) {
    if (cp.package_id && !packageIds.includes(cp.package_id) && !extraPkgIds.includes(cp.package_id)) {
      extraPkgIds.push(cp.package_id);
    }
  }
  if (extraPkgIds.length > 0) {
    const { data: extraPkgs } = await supabase.from('packages').select('id, name').in('id', extraPkgIds);
    if (extraPkgs) packages.push(...extraPkgs);
  }

  // 4. Map O(1) tra cứu trong bộ nhớ
  const staffMap = new Map<string, string>(staffs.map(s => [s.id, s.full_name]));
  const serviceMap = new Map<string, any>(services.map(s => [s.id, s]));
  const packageMap = new Map<string, string>(packages.map(p => [p.id, p.name]));
  const invoiceMap = new Map<string, any>(invoices.map(i => [i.id, i]));
  const sessionMap = new Map<string, any>(sessions.map(s => [s.id, s]));
  const packageSaleMap = new Map<string, any>(packageSales.map(ps => [ps.id, ps]));
  const custPkgMap = new Map<string, any>(custPkgs.map(cp => [cp.id, cp]));

  const itemsByInvoiceId = new Map<string, any[]>();
  for (const it of invoiceItems) {
    const list = itemsByInvoiceId.get(it.invoice_id) || [];
    list.push(it);
    itemsByInvoiceId.set(it.invoice_id, list);
  }

  // 5. Enrich từng bản ghi
  return rawLogs.map(r => {
    const sId = r.service_session_id || (r.type === 'package_session' ? r.reference_id : null);
    const psId = r.package_sale_id || (r.type === 'package_sale' ? r.reference_id : null);
    const invId = r.invoice_id || (r.type === 'retail' || r.type === 'combo' ? r.reference_id : null);

    const session = sId ? sessionMap.get(sId) : null;
    const pkgSale = psId ? packageSaleMap.get(psId) : null;
    const invoice = invId ? invoiceMap.get(invId) : (pkgSale?.invoice_id ? invoiceMap.get(pkgSale.invoice_id) : null);
    const items = invoice ? (itemsByInvoiceId.get(invoice.id) || []) : [];

    // 1. KỸ THUẬT VIÊN / NGƯỜI BÁN
    let techName: string | null = null;
    if (r.type === 'package_sale') {
      if (pkgSale?.seller_id && staffMap.has(pkgSale.seller_id)) {
        techName = staffMap.get(pkgSale.seller_id)!;
      }
    } else {
      if (session?.staff_id && staffMap.has(session.staff_id)) {
        techName = staffMap.get(session.staff_id)!;
      }
    }

    // 2. TÊN DỊCH VỤ / TÊN GÓI LIỆU TRÌNH
    let serviceName: string | null = null;
    if (r.type === 'package_sale') {
      if (pkgSale?.customer_package_id && custPkgMap.has(pkgSale.customer_package_id)) {
        const cp = custPkgMap.get(pkgSale.customer_package_id)!;
        if (cp.package_id && packageMap.has(cp.package_id)) {
          serviceName = packageMap.get(cp.package_id)!;
        }
      }
      if (!serviceName && items.length > 0) {
        const pkgItem = items.find(it => it.package_id && packageMap.has(it.package_id));
        if (pkgItem) serviceName = packageMap.get(pkgItem.package_id)!;
      }
    } else if (r.type === 'package_session') {
      if (session?.service_id && serviceMap.has(session.service_id)) {
        serviceName = serviceMap.get(session.service_id)!.name;
      } else if (session?.customer_package_id && custPkgMap.has(session.customer_package_id)) {
        const cp = custPkgMap.get(session.customer_package_id)!;
        if (cp.package_id && packageMap.has(cp.package_id)) {
          serviceName = packageMap.get(cp.package_id)!;
        }
      }
    } else {
      if (session?.service_id && serviceMap.has(session.service_id)) {
        serviceName = serviceMap.get(session.service_id)!.name;
      } else if (items.length > 0) {
        const names = items
          .map((it: any) => it.service_id ? serviceMap.get(it.service_id)?.name : it.package_id ? packageMap.get(it.package_id) : null)
          .filter(Boolean);
        if (names.length > 0) serviceName = names.join(', ');
      }
    }

    // 3. MÃ HÓA ĐƠN THẬT
    let rawInvoiceCode: string | null = null;
    if (invoice?.invoice_code) {
      rawInvoiceCode = invoice.invoice_code;
    } else if (session?.session_code) {
      rawInvoiceCode = session.session_code;
    }

    // 4. KHÁCH HÀNG
    let customerName = 'Khách lẻ';
    if (invoice?.customer_name) {
      customerName = invoice.customer_name;
    } else if (session?.customer_package_id && custPkgMap.has(session.customer_package_id)) {
      customerName = custPkgMap.get(session.customer_package_id)!.customer_name || 'Khách thẻ';
    } else if (pkgSale?.customer_package_id && custPkgMap.has(pkgSale.customer_package_id)) {
      customerName = custPkgMap.get(pkgSale.customer_package_id)!.customer_name || 'Khách thẻ';
    }

    const fallbackService = r.type === 'package_sale'
      ? 'Bán thẻ liệu trình'
      : r.type === 'package_session'
        ? 'Trừ buổi liệu trình'
        : 'Dịch vụ lẻ';

    // Mã hiển thị: Ưu tiên mã thật nếu có, KHÔNG tự sinh #HD... ngẫu nhiên
    const finalCode = rawInvoiceCode
      ? (rawInvoiceCode.startsWith('#') ? rawInvoiceCode : '#' + rawInvoiceCode)
      : '---';

    return {
      ...r,
      is_fake: false,
      staff_name: techName || '---',
      technician_name: techName || '---',
      service_name: serviceName || fallbackService,
      customer_name: customerName,
      mapped_invoice_code: rawInvoiceCode || null,
      mapped_session_code: session?.session_code || null,
      card_code: (session?.customer_package_id && custPkgMap.get(session.customer_package_id)?.card_code) ||
                 (pkgSale?.customer_package_id && custPkgMap.get(pkgSale.customer_package_id)?.card_code) || null,
      code: finalCode,
      quantity: 1,
      unit_price: Number(r.amount || 0),
      unitPrice: Number(r.amount || 0),
      amount: Number(r.amount || 0)
    };
  });
};
