import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

const isBuild = process.argv.includes('build');

export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    define: isBuild ? {} : { 'process.env.NODE_ENV': JSON.stringify('development') },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@astrojs/react/client.js',
        '@xyflow/react',
      ],
    },
  },
});
