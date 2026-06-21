DO $$
DECLARE
    v_source_shop_id UUID;
    v_target_shop_id UUID;
    v_group_record RECORD;
    v_new_group_id UUID;
    v_service_record RECORD;
BEGIN
    -- Lấy ID shop nguồn
    SELECT id INTO v_source_shop_id FROM public.shops WHERE shop_code = 'SPA-9OIFRM';
    IF v_source_shop_id IS NULL THEN
        RAISE EXCEPTION 'Source shop SPA-9OIFRM not found';
    END IF;

    -- Lấy ID shop đích
    SELECT id INTO v_target_shop_id FROM public.shops WHERE shop_code = 'SPA-Y9GP68';
    IF v_target_shop_id IS NULL THEN
        RAISE EXCEPTION 'Target shop SPA-Y9GP68 not found';
    END IF;

    -- Copy service groups
    FOR v_group_record IN SELECT * FROM public.service_groups WHERE shop_id = v_source_shop_id
    LOOP
        -- Chèn nhóm mới
        INSERT INTO public.service_groups (shop_id, name, sort_order)
        VALUES (v_target_shop_id, v_group_record.name, v_group_record.sort_order)
        RETURNING id INTO v_new_group_id;

        -- Copy services thuộc nhóm này
        FOR v_service_record IN SELECT * FROM public.services WHERE shop_id = v_source_shop_id AND service_group_id = v_group_record.id
        LOOP
            INSERT INTO public.services (shop_id, name, price, duration_minutes, commission_type, commission_value, service_group_id)
            VALUES (v_target_shop_id, v_service_record.name, v_service_record.price, v_service_record.duration_minutes, v_service_record.commission_type, v_service_record.commission_value, v_new_group_id);
        END LOOP;
    END LOOP;

    -- Copy services không thuộc nhóm nào
    FOR v_service_record IN SELECT * FROM public.services WHERE shop_id = v_source_shop_id AND service_group_id IS NULL
    LOOP
        INSERT INTO public.services (shop_id, name, price, duration_minutes, commission_type, commission_value, service_group_id)
        VALUES (v_target_shop_id, v_service_record.name, v_service_record.price, v_service_record.duration_minutes, v_service_record.commission_type, v_service_record.commission_value, NULL);
    END LOOP;

    RAISE NOTICE 'Copy completed successfully.';

END $$;
