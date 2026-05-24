CREATE OR REPLACE FUNCTION sp_checkout_package_session(
    p_session_id uuid,
    p_package_id uuid,
    p_revenue_amount numeric,
    p_commission_amount numeric
) RETURNS jsonb AS $$
DECLARE
    v_package record;
    v_used_sessions int;
    v_total_sessions int;
BEGIN
    -- Idempotency guard: nếu đã hoàn thành session, abort
    IF EXISTS (SELECT 1 FROM service_sessions WHERE id = p_session_id AND status = 'completed') THEN
        RAISE EXCEPTION 'Session % already completed', p_session_id;
    END IF;

    -- Lấy thông tin gói để ghi chú
    SELECT * INTO v_package FROM packages WHERE id = p_package_id;

    -- Update service_session
    UPDATE service_sessions
    SET status = 'completed',
        end_time = now(),
        revenue_amount = p_revenue_amount,
        commission_amount = p_commission_amount
    WHERE id = p_session_id;

    -- Update customer_package (increase used_sessions, possibly mark completed)
    UPDATE customer_packages cp
    SET used_sessions = cp.used_sessions + 1,
        status = CASE WHEN cp.used_sessions + 1 >= cp.total_sessions THEN 'completed' ELSE 'active' END
    FROM service_sessions ss
    WHERE ss.id = p_session_id
      AND cp.id = ss.customer_package_id
    RETURNING cp.used_sessions, cp.total_sessions INTO v_used_sessions, v_total_sessions;

    -- Insert revenue log (ledger)
    INSERT INTO revenue_logs (
        shop_id,
        amount,
        type,
        service_session_id
    ) VALUES (
        (SELECT shop_id FROM service_sessions WHERE id = p_session_id),
        p_revenue_amount,
        'package_session',
        p_session_id
    );

    -- Insert commission log
    INSERT INTO commission_logs (
        shop_id,
        staff_id,
        amount,
        type,
        service_session_id,
        note
    ) VALUES (
        (SELECT shop_id FROM service_sessions WHERE id = p_session_id),
        (SELECT staff_id FROM service_sessions WHERE id = p_session_id),
        p_commission_amount,
        'service_execution',
        p_session_id,
        COALESCE(v_package.name, 'Package Session')
    );

    RETURN jsonb_build_object('used_sessions', v_used_sessions, 'total_sessions', v_total_sessions);
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE;
