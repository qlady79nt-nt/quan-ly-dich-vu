CREATE OR REPLACE FUNCTION sp_checkout(
    p_session_id uuid,
    p_invoice_data jsonb,
    p_revenue_amount numeric,
    p_commission_amount numeric
) RETURNS uuid AS $$
DECLARE
    v_invoice_id uuid;
    v_service_id uuid;
    v_price numeric;
    v_quantity int := 1; -- always 1 for retail service
    v_service_name text;
BEGIN
    -- Idempotency guard: nếu invoice đã tồn tại cho session này, abort
    IF EXISTS (SELECT 1 FROM invoices WHERE service_session_id = p_session_id) THEN
        RAISE EXCEPTION 'Invoice already exists for session %', p_session_id;
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
        status
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
        p_invoice_data->>'status'
    RETURNING id INTO v_invoice_id;

    -- Insert invoice_items (retail service line)
    SELECT s.id, s.name, s.price INTO v_service_id, v_service_name, v_price
    FROM services s
    WHERE s.id = (p_invoice_data->>'service_id')::uuid;

    DECLARE
        v_invoice_item_id uuid;
    BEGIN
        INSERT INTO invoice_items (
            invoice_id,
            type,
            service_id,
            unit_price,
            final_price,
            price
        ) VALUES (
            v_invoice_id,
            'service',
            v_service_id,
            v_price,
            v_price,
            v_price
        ) RETURNING id INTO v_invoice_item_id;

        -- Insert revenue log (ledger)
        INSERT INTO revenue_logs (
            shop_id,
            amount,
            type,
            service_session_id,
            invoice_id
        ) VALUES (
            (p_invoice_data->>'shop_id')::uuid,
            p_revenue_amount,
            'retail',
            p_session_id,
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
            (p_invoice_data->>'staff_id')::uuid,
            p_commission_amount,
            'service_execution',
            p_session_id,
            p_invoice_data->>'note',
            v_invoice_item_id
        );
    END;

    -- Update service session status
    UPDATE service_sessions
    SET status = 'completed',
        end_time = now(),
        revenue_amount = p_revenue_amount,
        commission_amount = p_commission_amount
    WHERE id = p_session_id;

    RETURN v_invoice_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE;
