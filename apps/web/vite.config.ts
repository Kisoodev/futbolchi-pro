import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // `npm run dev:phone` opens the game to phones on the same Wi-Fi / hotspot.
    host: process.env.FUTBOLCHI_PHONE === '1' ? true : 'localhost',
    proxy: { '/api': 'http://localhost:8787' },
  },
});
