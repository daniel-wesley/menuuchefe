import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ['browser', 'import', 'module', 'default'],
  },
  optimizeDeps: {
    include: [
      '@supabase/supabase-js',
      '@supabase/supabase-js/dist/module',
      '@supabase/postgrest-js',
      '@supabase/gotrue-js',
      '@supabase/realtime-js',
      '@supabase/storage-js',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rolldownOptions: {
      resolve: {
        conditionNames: ['browser', 'import', 'module', 'default'],
      },
    },
  },
})


