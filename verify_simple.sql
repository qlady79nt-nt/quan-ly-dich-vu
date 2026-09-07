-- ==============================================================================
-- BƯỚC 1: GỌI RPC SINH DỮ LIỆU FAKE HISTORY CHO 1 NGÀY QUÁ KHỨ
-- (Lấy trực tiếp Shop đã có cấu hình 31 ngày)
-- ==============================================================================
SELECT * FROM public.sp_get_or_create_fake_revenue_day(
    (SELECT shop_id FROM public.shop_fake_revenue_configs LIMIT 1),
    '2026-01-05'::date
);

-- ==============================================================================
-- BƯỚC 2: ĐỐI SOÁT KHÓA NGÀY & KHỚP TỔNG TIỀN 100%
-- ==============================================================================
SELECT 
    l.shop_id,
    l.revenue_date,
    l.base_amount,
    l.generated_total,
    l.item_count,
    COUNT(r.id) AS actual_records_count,
    SUM(r.amount) AS actual_records_sum,
    CASE WHEN SUM(r.amount) = l.generated_total THEN 'PASS' ELSE 'FAIL' END AS sum_check
FROM public.shop_fake_daily_locks l
JOIN public.fake_revenue_records r ON r.daily_lock_id = l.id
GROUP BY l.id, l.shop_id, l.revenue_date, l.base_amount, l.generated_total, l.item_count;

-- ==============================================================================
-- BƯỚC 3: KIỂM TRA BẢO VỆ NGÀY HÔM NAY (KẾT QUẢ PHẢI = 0 DÒNG)
-- ==============================================================================
SELECT * FROM public.sp_get_or_create_fake_revenue_day(
    (SELECT shop_id FROM public.shop_fake_revenue_configs LIMIT 1),
    CURRENT_DATE
);
