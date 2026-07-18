import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { app } from '../server/index.js';
import { serverConfig } from '../server/config.js';
import type { SendEmailResponse } from '../shared/email.js';

const originalEmailService = serverConfig.emailService;
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;

let server: Server;
let baseUrl: string;

describe('built send email flow', () => {
  before(async () => {
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    serverConfig.emailService = {
      url: 'https://email.mctai.test/send',
      appToken: 'app_e2e_token'
    };
  });

  afterEach(() => {
    serverConfig.emailService = originalEmailService;
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  test('serves the built client and completes a send request', async () => {
    const platformCalls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
      platformCalls.push({ input, init });
      return new Response(JSON.stringify({ id: 'message_e2e_123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const home = await originalFetch(`${baseUrl}/`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /<div id="root">/);

    const response = await requestJson('/api/send-email', {
      recipient: '  person@example.com  ',
      subject: '  E2E hello  ',
      message: 'Line one\nLine two'
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true });
    assert.equal(platformCalls.length, 1);
    assert.equal(platformCalls[0].input, 'https://email.mctai.test/send');
    assert.deepEqual(JSON.parse(String(platformCalls[0].init?.body)), {
      to: 'person@example.com',
      subject: 'E2E hello',
      text: 'Line one\nLine two',
      html: 'Line one<br>Line two'
    });
  });

  test('returns a stable error response when the email service fails', async () => {
    console.error = () => undefined;
    globalThis.fetch = async () =>
      new Response('provider unavailable', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' }
      });

    const response = await requestJson('/api/send-email', {
      recipient: 'person@example.com',
      subject: 'E2E failure',
      message: 'This should fail upstream.'
    });

    assert.equal(response.status, 502);
    assert.deepEqual(response.body, {
      ok: false,
      error: 'send_failed'
    });
  });
});

async function requestJson(
  path: string,
  body: unknown
): Promise<{ status: number; body: SendEmailResponse }> {
  const response = await originalFetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return {
    status: response.status,
    body: (await response.json()) as SendEmailResponse
  };
}
