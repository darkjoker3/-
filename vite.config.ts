import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      legacy({
        targets: [
          'defaults',
          'not IE 11',
          'iOS >= 11',
          'Safari >= 11',
          'Chrome >= 58',
          'Android >= 5',
          'Samsung >= 8',
        ],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
        renderLegacyChunks: true,
        modernPolyfills: true,
      }),
      {
        name: 'resolve-maps-url-server',
        configureServer(server) {
          server.middlewares.use('/api/resolve-maps-url', async (req, res) => {
            try {
              const parsed = new URL(req.url || '', 'http://localhost');
              const targetUrl = parsed.searchParams.get('url');
              if (!targetUrl) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'url parameter required' }));
                return;
              }

              const response = await fetch(targetUrl, {
                method: 'GET',
                redirect: 'follow',
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
              });

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ resolvedUrl: response.url }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Failed to resolve' }));
            }
          });
        },
      },
    ],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(process.cwd(), '.'),
        react: path.resolve(process.cwd(), 'node_modules/react'),
        'react-dom': path.resolve(process.cwd(), 'node_modules/react-dom'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react',
        'leaflet',
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      target: ['es2015', 'chrome58', 'firefox57', 'safari11', 'ios11', 'edge16'],
      cssTarget: ['chrome58', 'firefox57', 'safari11', 'ios11', 'edge16'],
    },
  };
});
