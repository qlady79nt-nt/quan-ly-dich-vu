import { supabase } from './supabase';

export interface ShopPrintSettings {
  id?: string;
  shop_id: string;
  paper_size: '58mm' | '80mm';
  top_offset: number;
  left_offset: number;
  scale_percent: number;
}

export const DEFAULT_PRINT_SETTINGS: Omit<ShopPrintSettings, 'shop_id'> = {
  paper_size: '58mm',
  top_offset: 0,
  left_offset: 0,
  scale_percent: 100,
};

export const getPrintSettings = async (shopId: string): Promise<ShopPrintSettings> => {
  if (!shopId) return { shop_id: '', ...DEFAULT_PRINT_SETTINGS };

  try {
    const { data, error } = await supabase
      .from('shop_print_settings')
      .select('*')
      .eq('shop_id', shopId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching print settings:', error);
      return { shop_id: shopId, ...DEFAULT_PRINT_SETTINGS };
    }

    if (data) {
      return data as ShopPrintSettings;
    }
  } catch (err) {
    console.error('Unexpected error fetching print settings:', err);
  }
  
  return { shop_id: shopId, ...DEFAULT_PRINT_SETTINGS };
};

export const updatePrintSettings = async (settings: ShopPrintSettings): Promise<boolean> => {
  if (!settings.shop_id) return false;

  try {
    // Check if exists first
    const { data: existing } = await supabase
      .from('shop_print_settings')
      .select('id')
      .eq('shop_id', settings.shop_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('shop_print_settings')
        .update({
          paper_size: settings.paper_size,
          top_offset: settings.top_offset,
          left_offset: settings.left_offset,
          scale_percent: settings.scale_percent,
        })
        .eq('shop_id', settings.shop_id);
      
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('shop_print_settings')
        .insert([{
          shop_id: settings.shop_id,
          paper_size: settings.paper_size,
          top_offset: settings.top_offset,
          left_offset: settings.left_offset,
          scale_percent: settings.scale_percent,
        }]);
      
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.error('Error updating print settings:', err);
    return false;
  }
};
