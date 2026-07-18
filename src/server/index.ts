import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { serverConfig } from './config.js';
import type { SendEmailRequest, SendEmailResponse } from '../shared/email.js';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const clientDistDir = path.resolve(currentDir, '../client');
export const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post('/api/send-email', async (req, res, next) => {
  try {
    const payload = parseSendEmailRequest(req.body);
    const fields = validateSendEmailRequest(payload);

    if (Object.keys(fields).length > 0) {
      const response: SendEmailResponse = { ok: false, error: 'validation_error', fields };
      return res.status(400).json(response);
    }

    if (!serverConfig.emailService) {
      const response: SendEmailResponse = { ok: false, error: 'email_unconfigured' };
      return res.status(503).json(response);
    }

    const emailResponse = await fetch(serverConfig.emailService.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serverConfig.emailService.appToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: payload.recipient,
        subject: payload.subject,
        text: payload.message,
        html: formatEmailHtml(payload.message)
      })
    });

    if (emailResponse.status === 429) {
      const response: SendEmailResponse = { ok: false, error: 'rate_limited' };
      return res.status(429).json(response);
    }

    if (!emailResponse.ok) {
      const upstreamBody = await emailResponse.text();
      console.error('Email service request failed', {
        status: emailResponse.status,
        body: upstreamBody.slice(0, 500)
      });
      const response: SendEmailResponse = { ok: false, error: 'send_failed' };
      return res.status(502).json(response);
    }

    const response: SendEmailResponse = { ok: true };
    return res.status(200).json(response);
  } catch (err) {
    return next(err);
  }
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

if (process.argv[1] === currentFile) {
  app.listen(serverConfig.port, serverConfig.host, () => {
    console.log(`Server listening on http://${serverConfig.host}:${serverConfig.port}`);
  });
}

function parseSendEmailRequest(body: unknown): SendEmailRequest {
  const record = isRecord(body) ? body : {};

  return {
    recipient: typeof record.recipient === 'string' ? record.recipient.trim() : '',
    subject: typeof record.subject === 'string' ? record.subject.trim() : '',
    message: typeof record.message === 'string' ? record.message.trim() : ''
  };
}

function validateSendEmailRequest(
  payload: SendEmailRequest
): Partial<Record<keyof SendEmailRequest, string>> {
  const fields: Partial<Record<keyof SendEmailRequest, string>> = {};

  if (!payload.recipient) {
    fields.recipient = 'Recipient is required.';
  } else if (!isValidEmailAddress(payload.recipient)) {
    fields.recipient = 'Enter a valid email address.';
  }

  if (!payload.subject) {
    fields.subject = 'Subject is required.';
  } else if (payload.subject.length > 200) {
    fields.subject = 'Subject must be 200 characters or fewer.';
  }

  if (!payload.message) {
    fields.message = 'Message is required.';
  } else if (payload.message.length > 10000) {
    fields.message = 'Message must be 10,000 characters or fewer.';
  }

  return fields;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatEmailHtml(message: string): string {
  return escapeHtml(message).replace(/\r?\n/g, '<br>');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
