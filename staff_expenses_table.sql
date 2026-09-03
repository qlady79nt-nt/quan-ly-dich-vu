-- Tạo bảng staff_expenses
CREATE TABLE IF NOT EXISTS public.staff_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.staffs(id) ON DELETE CASCADE,
    
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Các trường tiền nong dựa chuẩn xác theo ExpenseData trong code UI
    salary NUMERIC DEFAULT 0,
    commission NUMERIC DEFAULT 0,
    bonus NUMERIC DEFAULT 0,
    
    tip NUMERIC DEFAULT 0,
    bonus_tip NUMERIC DEFAULT 0,
    
    overtime NUMERIC DEFAULT 0, -- Số phút tăng ca
    overtime_money NUMERIC DEFAULT 0, -- Tiền tăng ca
    bonus_overtime NUMERIC DEFAULT 0,
    
    tour NUMERIC DEFAULT 0,
    bonus_tour NUMERIC DEFAULT 0,
    
    meal NUMERIC DEFAULT 0,
    bonus_meal NUMERIC DEFAULT 0,
    
    kpi NUMERIC DEFAULT 0,
    support NUMERIC DEFAULT 0, -- Tiền hỗ trợ (Advance/Support)

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ràng buộc unique (Mỗi nhân viên chỉ có 1 dòng dữ liệu trong 1 khoảng thời gian cụ thể)
ALTER TABLE public.staff_expenses 
ADD CONSTRAINT staff_expenses_unique_period UNIQUE (shop_id, staff_id, period_start, period_end);

-- Bật Row Level Security (RLS)
ALTER TABLE public.staff_expenses ENABLE ROW LEVEL SECURITY;

-- Tạo Policy cho RLS
DROP POLICY IF EXISTS data_isolation_staff_expenses ON public.staff_expenses;
CREATE POLICY data_isolation_staff_expenses 
ON public.staff_expenses FOR ALL 
USING (shop_id = auth_user_shop_id() OR is_super_admin())
WITH CHECK (shop_id = auth_user_shop_id() OR is_super_admin());

-- Index để truy vấn nhanh hơn theo khoảng thời gian
CREATE INDEX IF NOT EXISTS idx_staff_expenses_period 
ON public.staff_expenses(shop_id, period_start, period_end);
