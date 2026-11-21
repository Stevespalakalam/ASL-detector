
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const diskStoragePlugin = (): Plugin => ({
  name: 'disk-storage-api',
  configureServer(server) {
    const dataFilePath = path.resolve(__dirname, 'library-data.json');
    const recordingsDir = path.resolve(__dirname, 'recordings');
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }

    // Video streaming endpoint for recorded takes
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith('/api/video/')) {
        const takeId = req.url.replace('/api/video/', '').split('?')[0];
        const videoPath = path.resolve(recordingsDir, `${takeId}.webm`);
        if (fs.existsSync(videoPath)) {
          const stat = fs.statSync(videoPath);
          const range = req.headers.range;
          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunksize = end - start + 1;
            const file = fs.createReadStream(videoPath, { start, end });
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': 'video/webm',
            });
            file.pipe(res);
            return;
          } else {
            res.writeHead(200, {
              'Content-Length': stat.size,
              'Content-Type': 'video/webm',
            });
            fs.createReadStream(videoPath).pipe(res);
            return;
          }
        }
        res.statusCode = 404;
        res.end('Video not found');
        return;
      }
      next();
    });

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
            const data = JSON.parse(body);
            if (data && Array.isArray(data.signs)) {
              data.signs.forEach((s: any) => {
                if (Array.isArray(s.takes)) {
                  s.takes.forEach((t: any) => {
                    if (t.videoUrl && t.videoUrl.startsWith('data:video/')) {
                      const match = t.videoUrl.match(/^data:video\/[^;]+;base64,(.+)$/);
                      if (match) {
                        const buffer = Buffer.from(match[1], 'base64');
                        fs.writeFileSync(path.join(recordingsDir, `${t.id}.webm`), buffer);
                        t.videoUrl = `/api/video/${t.id}`;
                      }
                    }
                  });
                }
              });
            }
            fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
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
