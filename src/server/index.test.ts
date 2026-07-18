import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { app } from './index.js';
import { serverConfig } from './config.js';
import type { SendEmailResponse } from '../shared/email.js';

const originalEmailService = serverConfig.emailService;
const originalFetch = globalThis.fetch;

let server: Server;
let baseUrl: string;

describe('POST /api/send-email', () => {
  before(async () => {
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    serverConfig.emailService = {
      url: 'https://email.mctai.test/send',
      appToken: 'app_test_token'
    };
  });

  afterEach(() => {
    serverConfig.emailService = originalEmailService;
    globalThis.fetch = originalFetch;
  });

  after(() => {
    server.close();
  });

  test('returns field errors for an invalid payload', async () => {
    const response = await requestJson('/api/send-email', {
      recipient: 'not-an-email',
      subject: '',
      message: ''
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      ok: false,
      error: 'validation_error',
      fields: {
        recipient: 'Enter a valid email address.',
        subject: 'Subject is required.',
        message: 'Message is required.'
      }
    });
  });

  test('returns email_unconfigured when platform email is unavailable', async () => {
    serverConfig.emailService = null;

    const response = await requestJson('/api/send-email', validPayload());

    assert.equal(response.status, 503);
    assert.deepEqual(response.body, {
      ok: false,
      error: 'email_unconfigured'
    });
  });

  test('forwards a normalized email request to the platform email service', async () => {
    const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ id: 'message_123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const response = await requestJson('/api/send-email', {
      recipient: '  person@example.com  ',
      subject: '  Hello  ',
      message: 'Line one\nLine <two>'
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, 'https://email.mctai.test/send');
    assert.deepEqual(calls[0].init?.headers, {
      Authorization: 'Bearer app_test_token',
      'Content-Type': 'application/json'
    });
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      to: 'person@example.com',
      subject: 'Hello',
      text: 'Line one\nLine <two>',
      html: 'Line one<br>Line &lt;two&gt;'
    });
  });

  test('maps platform rate limiting to a rate_limited response', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });

    const response = await requestJson('/api/send-email', validPayload());

    assert.equal(response.status, 429);
    assert.deepEqual(response.body, {
      ok: false,
      error: 'rate_limited'
    });
  });
});

function validPayload() {
  return {
    recipient: 'person@example.com',
    subject: 'Hello',
    message: 'A short message.'
  };
}

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
