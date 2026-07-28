import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wxtagxiuzrfcqlcjtjdj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4dGFneGl1enJmY3FsY2p0amRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTkzMzcsImV4cCI6MjEwMDYzNTMzN30.qSVZNZrti_fKCjikh-_OxBVBZ2yKFGrfumv7YjLj5Hw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
