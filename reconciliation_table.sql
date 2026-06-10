CREATE TABLE IF NOT EXISTS public.revenue_reconciliations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    reconciliation_date DATE NOT NULL,
    software_revenue NUMERIC NOT NULL DEFAULT 0,
    actual_cash NUMERIC NOT NULL DEFAULT 0,
    actual_transfer NUMERIC NOT NULL DEFAULT 0,
    difference NUMERIC NOT NULL DEFAULT 0,
    note TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.revenue_reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_isolation_revenue_reconciliations ON public.revenue_reconciliations;
CREATE POLICY data_isolation_revenue_reconciliations 
ON public.revenue_reconciliations 
FOR ALL 
USING (
    shop_id = auth_user_shop_id() OR is_super_admin()
);

-- Create an index to make queries faster
CREATE INDEX IF NOT EXISTS idx_revenue_reconciliations_shop_id_date 
ON public.revenue_reconciliations(shop_id, reconciliation_date DESC);
