import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wxtagxiuzrfcqlcjtjdj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4dGFneGl1enJmY3FsY2p0amRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTkzMzcsImV4cCI6MjEwMDYzNTMzN30.qSVZNZrti_fKCjikh-_OxBVBZ2yKFGrfumv7YjLj5Hw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BUCKET = 'product-images';

export async function uploadProductImage(file) {
  if (!file) return null;
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `products/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
    contentType: file.type || 'image/png',
    upsert: true,
  });
  if (error) {
    console.error('Erro no upload da imagem:', error);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data?.publicUrl || null;
}

export function getProductImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return imageUrl;
}

export async function migrateBackendImage(backendBaseUrl, oldPath) {
  try {
    const resp = await fetch(`${backendBaseUrl}${oldPath}`);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const ext = oldPath.split('.').pop() || 'png';
    const fileName = `products/migrated-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(fileName, blob, {
      contentType: blob.type || 'image/png',
      upsert: true,
    });
    if (error) {
      console.error('Erro na migração da imagem:', error);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return data?.publicUrl || null;
  } catch (err) {
    console.error('Falha ao buscar imagem do backend:', err);
    return null;
  }
}
