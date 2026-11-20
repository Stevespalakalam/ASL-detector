
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const diskStoragePlugin = (): Plugin => ({
  name: 'disk-storage-api',
  configureServer(server) {
    const dataFilePath = path.resolve(__dirname, 'library-data.json');

    server.middlewares.use('/api/data', (req, res) => {
      if (req.method === 'GET') {
        if (fs.existsSync(dataFilePath)) {
          try {
            const content = fs.readFileSync(dataFilePath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(content);
            return;
          } catch (e) {
            console.error('Error reading library-data.json:', e);
          }
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ signs: [], settings: { confidenceThreshold: 0.8, minSamples: 5 } }));
      } else if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            fs.writeFileSync(dataFilePath, body, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            console.error('Error saving library-data.json to disk:', e);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to write file' }));
          }
        });
      } else {
        res.statusCode = 405;
        res.end();
      }
    });
  },
});

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), diskStoragePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
