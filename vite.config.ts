import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      // The app shipped as one 1.6MB bundle, so every visitor downloaded the
      // chess engine, charts and Firebase before the first screen could paint.
      // Splitting by vendor lets the browser cache them independently.
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'vendor-firebase';
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory')) return 'vendor-charts';
            if (id.includes('node_modules/chess.js') || id.includes('node_modules/react-chessboard')) return 'vendor-chess';
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) return 'vendor-motion';
            if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
            return 'vendor';
          },
        },
      },
      chunkSizeWarningLimit: 700,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
