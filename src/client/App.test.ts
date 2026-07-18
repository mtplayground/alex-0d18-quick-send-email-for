import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import {
  maxMessageLength,
  maxSubjectLength,
  normalizeForm,
  sendEmail,
  validateForm
} from './App';
import type { SendEmailRequest } from '../shared/email';

const originalFetch = globalThis.fetch;

describe('send form validation', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('normalizes form fields before validation and submit', () => {
    assert.deepEqual(
      normalizeForm({
        recipient: '  person@example.com  ',
        subject: '  Hello  ',
        message: '  Message body  '
      }),
      {
        recipient: 'person@example.com',
        subject: 'Hello',
        message: 'Message body'
      }
    );
  });

  test('returns field errors for missing and invalid values', () => {
    assert.deepEqual(
      validateForm({
        recipient: 'not-an-email',
        subject: '',
        message: ''
      }),
      {
        recipient: 'Enter a valid email address.',
        subject: 'Subject is required.',
        message: 'Message is required.'
      }
    );
  });

  test('enforces subject and message length limits', () => {
    const fields = validateForm({
      recipient: 'person@example.com',
      subject: 'x'.repeat(maxSubjectLength + 1),
      message: 'x'.repeat(maxMessageLength + 1)
    });

    assert.equal(fields.subject, `Subject must be ${maxSubjectLength} characters or fewer.`);
    assert.equal(
      fields.message,
      `Message must be ${maxMessageLength.toLocaleString()} characters or fewer.`
    );
  });
});

describe('send form API submit flow', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('posts the email payload to the backend endpoint', async () => {
    const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const payload: SendEmailRequest = {
      recipient: 'person@example.com',
      subject: 'Hello',
      message: 'A short message.'
    };

    const result = await sendEmail(payload);

    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, '/api/send-email');
    assert.deepEqual(calls[0].init?.headers, { 'Content-Type': 'application/json' });
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), payload);
  });

  test('rejects unexpected non-JSON backend responses', async () => {
    globalThis.fetch = async () =>
      new Response('bad gateway', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' }
      });

    await assert.rejects(
      () =>
        sendEmail({
          recipient: 'person@example.com',
          subject: 'Hello',
          message: 'A short message.'
        }),
      /Expected JSON response/
    );
  });
});
