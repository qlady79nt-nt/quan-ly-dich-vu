-- Drop function if exists
DROP FUNCTION IF EXISTS sp_checkout_multi_retail(jsonb, jsonb);

-- Create RPC for Multi Retail Checkout
CREATE OR REPLACE FUNCTION sp_checkout_multi_retail(
    p_invoice_data jsonb,
    p_sessions_data jsonb -- Array of { session_id, service_id, staff_id, original_price, revenue_amount, commission_amount, note, discount_type, discount_value }
) RETURNS uuid AS $$
DECLARE
    v_invoice_id uuid;
    v_session jsonb;
    v_invoice_item_id uuid;
    v_session_id uuid;
BEGIN
    -- Guard: Ensure no package sessions are included
    IF EXISTS (
        SELECT 1
        FROM service_sessions
        WHERE id IN (SELECT (value->>'session_id')::uuid FROM jsonb_array_elements(p_sessions_data))
        AND customer_package_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Package sessions cannot be included in multi retail checkout';
    END IF;

    -- Guard: Ensure none of the sessions are already invoiced
    -- Since we might have concurrent checkout attempts
    IF EXISTS (
        SELECT 1
        FROM service_sessions
        WHERE id IN (SELECT (value->>'session_id')::uuid FROM jsonb_array_elements(p_sessions_data))
        AND status = 'completed'
    ) THEN
        RAISE EXCEPTION 'One or more sessions have already been checked out';
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
        p_invoice_data->>'note'
    RETURNING id INTO v_invoice_id;

    -- Loop through sessions
    FOR v_session IN SELECT * FROM jsonb_array_elements(p_sessions_data)
    LOOP
        v_session_id := (v_session->>'session_id')::uuid;

        -- We also need to link the invoice to the session to track it in standard checkout?
        -- Actually, retail sessions normally use service_session_id in invoices.
        -- But for multi checkout, 1 invoice maps to many sessions. We can't use service_session_id in invoices.
        -- We will just link via invoice_items, and update service_sessions.
        
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
            'retail',
            v_session_id,
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
            v_session_id,
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
        WHERE id = v_session_id;
    END LOOP;

    RETURN v_invoice_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE;
