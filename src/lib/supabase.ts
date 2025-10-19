import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface CatalogItem {
  id: string;
  code: string;
  description: string;
  tags: string[];
  geometry_data: any;
  preview_image?: string;
  created_at?: string;
}

export const catalogService = {
  async getAll(): Promise<CatalogItem[]> {
    const { data, error } = await supabase
      .from('geometry_catalog')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching catalog:', error);
      return [];
    }

    return data || [];
  },

  async save(item: Omit<CatalogItem, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase
      .from('geometry_catalog')
      .insert([item]);

    if (error) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('geometry_catalog')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }
};
