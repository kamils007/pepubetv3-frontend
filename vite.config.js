import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/pepubetv3-frontend/', // 👈 to jest kluczowe!
  plugins: [react()],
});
