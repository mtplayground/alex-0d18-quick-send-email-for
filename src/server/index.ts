import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number.parseInt(process.env.PORT ?? '8080', 10);
const host = '0.0.0.0';
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const clientDistDir = path.resolve(currentDir, '../client');

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use(express.static(clientDistDir));

app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDistDir, 'index.html'));
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('Unhandled request error', {
    name: err instanceof Error ? err.name : undefined,
    code: typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined
  });
  res.status(500).json({ ok: false, error: 'internal_error' });
};

app.use(errorHandler);

app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
