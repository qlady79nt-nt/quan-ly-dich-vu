-- Tạo bảng service_groups nếu chưa có (do bạn báo đã có trên Supabase nên lệnh IF NOT EXISTS sẽ bảo vệ an toàn)
CREATE TABLE IF NOT EXISTS public.service_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Thêm RLS (Row Level Security) cho bảng service_groups
ALTER TABLE public.service_groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'service_groups' AND policyname = 'Users can view their shop service groups'
    ) THEN
        CREATE POLICY "Users can view their shop service groups" ON public.service_groups
            FOR SELECT USING (
                shop_id IN (
                    SELECT shop_id FROM public.profiles WHERE profiles.id = auth.uid()
                )
            );
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'service_groups' AND policyname = 'Shop admins can manage service groups'
    ) THEN
        CREATE POLICY "Shop admins can manage service groups" ON public.service_groups
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.shop_id = service_groups.shop_id
                    AND profiles.role IN ('shop_admin', 'super_admin')
                )
            );
    END IF;
END $$;

-- Đảm bảo bảng services có cột service_group_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'service_group_id') THEN
        ALTER TABLE public.services ADD COLUMN service_group_id UUID REFERENCES public.service_groups(id) ON DELETE SET NULL;
    END IF;
END $$;
