import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface CatalogItem {
  id: string;
  code: string;
  description: string;
  tags: string[];
  geometry_data: any;
  created_at: string;
  updated_at: string;
}

export const catalogService = {
  async getAll(): Promise<CatalogItem[]> {
    const { data, error } = await supabase
      .from('geometry_catalog')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching catalog items:', error);
      return [];
    }

    return data || [];
  },

  async save(item: {
    code: string;
    description: string;
    tags: string[];
    geometry_data: any;
    preview_image?: string;
  }): Promise<CatalogItem | null> {
    const { data: existing } = await supabase
      .from('geometry_catalog')
      .select('id')
      .eq('code', item.code)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('geometry_catalog')
        .update({
          description: item.description,
          tags: item.tags,
          geometry_data: item.geometry_data,
          preview_image: item.preview_image,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating catalog item:', error);
        throw error;
      }

      return data;
    }

    const { data, error } = await supabase
      .from('geometry_catalog')
      .insert([{
        ...item,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Error saving catalog item:', error);
      throw error;
    }

    return data;
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('geometry_catalog')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting catalog item:', error);
      return false;
    }

    return true;
  },

  async update(id: string, updates: Partial<CatalogItem>): Promise<CatalogItem | null> {
    const { data, error } = await supabase
      .from('geometry_catalog')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating catalog item:', error);
      return null;
    }

    return data;
  }
};
