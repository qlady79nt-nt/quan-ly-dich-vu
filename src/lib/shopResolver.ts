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

export const generateShopCode = (shopName: string): string => {
  // Loại bỏ dấu tiếng Việt
  const noAccents = shopName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Chỉ lấy chữ cái, bỏ qua khoảng trắng, số và ký tự đặc biệt
  const lettersOnly = noAccents.replace(/[^a-zA-Z]/g, '').toUpperCase();
  // Lấy tối đa 3 chữ cái đầu, nếu không có chữ cái nào thì fallback về SPA
  const prefix = lettersOnly.substring(0, 3) || 'SPA';
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${randomStr}`;
};
