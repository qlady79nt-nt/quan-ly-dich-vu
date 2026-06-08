CREATE TABLE IF NOT EXISTS combo_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    combo_code TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    bed_id UUID REFERENCES beds(id),
    status TEXT DEFAULT 'in_progress',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(shop_id, combo_code)
);

-- Add columns to link sessions and invoices to combo groups
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS combo_group_id UUID REFERENCES combo_groups(id) ON DELETE SET NULL;
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS service_price NUMERIC;
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'amount';
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS combo_group_id UUID REFERENCES combo_groups(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount_type TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0;

-- Enable RLS on combo_groups
ALTER TABLE combo_groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'combo_groups' AND policyname = 'Users can view combo groups of their shop') THEN
        CREATE POLICY "Users can view combo groups of their shop"
            ON combo_groups FOR SELECT
            USING (shop_id = auth_user_shop_id() OR is_super_admin());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'combo_groups' AND policyname = 'Users can create combo groups in their shop') THEN
        CREATE POLICY "Users can create combo groups in their shop"
            ON combo_groups FOR INSERT
            WITH CHECK (shop_id = auth_user_shop_id() OR is_super_admin());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'combo_groups' AND policyname = 'Users can update combo groups in their shop') THEN
        CREATE POLICY "Users can update combo groups in their shop"
            ON combo_groups FOR UPDATE
            USING (shop_id = auth_user_shop_id() OR is_super_admin());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'combo_groups' AND policyname = 'Users can delete combo groups in their shop') THEN
        CREATE POLICY "Users can delete combo groups in their shop"
            ON combo_groups FOR DELETE
            USING (shop_id = auth_user_shop_id() OR is_super_admin());
    END IF;
END $$;

-- Drop function if exists to avoid signature mismatch
DROP FUNCTION IF EXISTS sp_checkout_combo(uuid, jsonb, jsonb);

-- Create RPC for Combo Checkout
CREATE OR REPLACE FUNCTION sp_checkout_combo(
    p_combo_group_id uuid,
    p_invoice_data jsonb,
    p_sessions_data jsonb -- Array of { session_id, service_id, staff_id, original_price, revenue_amount, commission_amount, note, discount_type, discount_value }
) RETURNS uuid AS $$
DECLARE
    v_invoice_id uuid;
    v_session jsonb;
    v_invoice_item_id uuid;
BEGIN
    -- Idempotency check: Ensure the invoice for this combo group hasn't been generated yet
    IF EXISTS (SELECT 1 FROM invoices WHERE combo_group_id = p_combo_group_id) THEN
        RAISE EXCEPTION 'Invoice already exists for combo group %', p_combo_group_id;
    END IF;

    -- Insert invoice
    INSERT INTO invoices (
        shop_id,
        invoice_code,
        customer_name,
        customer_phone,
        created_by,
        total_amount,
        discount_amount,
        final_amount,
        status,
        combo_group_id,
        note
    )
    SELECT
        (p_invoice_data->>'shop_id')::uuid,
        p_invoice_data->>'invoice_code',
        p_invoice_data->>'customer_name',
        p_invoice_data->>'customer_phone',
        (p_invoice_data->>'created_by')::uuid,
        (p_invoice_data->>'total_amount')::numeric,
        (p_invoice_data->>'discount_amount')::numeric,
        (p_invoice_data->>'final_amount')::numeric,
        p_invoice_data->>'status',
        p_combo_group_id,
        p_invoice_data->>'note'
    RETURNING id INTO v_invoice_id;

    -- Loop through sessions
    FOR v_session IN SELECT * FROM jsonb_array_elements(p_sessions_data)
    LOOP
        -- Insert invoice_items
        INSERT INTO invoice_items (
            invoice_id,
            type,
            service_id,
            unit_price,
            final_price,
            price,
            discount_type,
            discount_value
        ) VALUES (
            v_invoice_id,
            'service',
            (v_session->>'service_id')::uuid,
            (v_session->>'original_price')::numeric,
            (v_session->>'revenue_amount')::numeric,
            (v_session->>'original_price')::numeric,
            v_session->>'discount_type',
            (v_session->>'discount_value')::numeric
        ) RETURNING id INTO v_invoice_item_id;

        -- Insert revenue log
        INSERT INTO revenue_logs (
            shop_id,
            amount,
            type,
            service_session_id,
            invoice_id
        ) VALUES (
            (p_invoice_data->>'shop_id')::uuid,
            (v_session->>'revenue_amount')::numeric,
            'combo',
            (v_session->>'session_id')::uuid,
            v_invoice_id
        );

        -- Insert commission log
        INSERT INTO commission_logs (
            shop_id,
            staff_id,
            amount,
            type,
            service_session_id,
            note,
            invoice_item_id
        ) VALUES (
            (p_invoice_data->>'shop_id')::uuid,
            (v_session->>'staff_id')::uuid,
            (v_session->>'commission_amount')::numeric,
            'service_execution',
            (v_session->>'session_id')::uuid,
            v_session->>'note',
            v_invoice_item_id
        );

        -- Update session status
        UPDATE service_sessions
        SET status = 'completed',
            end_time = now(),
            service_price = (v_session->>'original_price')::numeric,
            revenue_amount = (v_session->>'revenue_amount')::numeric,
            commission_amount = (v_session->>'commission_amount')::numeric,
            discount_type = v_session->>'discount_type',
            discount_value = (v_session->>'discount_value')::numeric
        WHERE id = (v_session->>'session_id')::uuid;
    END LOOP;

    -- Update combo group status
    UPDATE combo_groups
    SET status = 'completed'
    WHERE id = p_combo_group_id;

    RETURN v_invoice_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE;
