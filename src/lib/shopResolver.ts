import { supabase } from './supabase';

export const resolveShopByCode = async (shopCode: string) => {
  if (!shopCode) return null;
  
  try {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .ilike('shop_code', shopCode)
      .single();
      
    if (error || !data) return null;
    return data;
  } catch (err) {
    return null;
  }
};
