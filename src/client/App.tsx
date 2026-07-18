import { useState, type FormEvent } from 'react';

import type { SendEmailRequest, SendEmailResponse } from '../shared/email';

type FormFields = Partial<Record<keyof SendEmailRequest, string>>;

const initialForm: SendEmailRequest = {
  recipient: '',
  subject: '',
  message: ''
};

export function App() {
  const [form, setForm] = useState<SendEmailRequest>(initialForm);
  const [fields, setFields] = useState<FormFields>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextFields = validateForm(form);
    setFields(nextFields);

    if (Object.keys(nextFields).length > 0) {
      setStatus('failed');
      setStatusMessage('Check the highlighted fields and try again.');
      return;
    }

    setStatus('sending');
    setStatusMessage('');

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const result = (await response.json()) as SendEmailResponse;

      if (result.ok) {
        setForm(initialForm);
        setFields({});
        setStatus('sent');
        setStatusMessage('Email sent.');
        return;
      }

      if (result.error === 'validation_error') {
        setFields(result.fields ?? {});
        setStatusMessage('Check the highlighted fields and try again.');
      } else {
        setStatusMessage(getErrorMessage(result.error));
      }

      setStatus('failed');
    } catch {
      setStatus('failed');
      setStatusMessage('The email could not be sent. Check your connection and try again.');
    }
  }

  function updateField(field: keyof SendEmailRequest, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFields((current) => ({ ...current, [field]: undefined }));
    if (status !== 'sending') {
      setStatus('idle');
      setStatusMessage('');
    }
  }

  return (
    <main className="app-shell" aria-labelledby="page-title">
      <section className="send-panel">
        <div className="panel-heading">
          <p className="eyebrow">One message, one click</p>
          <h1 id="page-title">Send Email</h1>
          <p className="lede">
            Enter a recipient, subject, and message. Keep it focused, review it once,
            and send when ready.
          </p>
        </div>

        <form className="send-form" onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label htmlFor="recipient">Recipient</label>
            <input
              id="recipient"
              name="recipient"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={form.recipient}
              aria-invalid={Boolean(fields.recipient)}
              aria-describedby={fields.recipient ? 'recipient-error' : undefined}
              onChange={(event) => updateField('recipient', event.target.value)}
            />
            {fields.recipient ? (
              <p className="field-error" id="recipient-error">
                {fields.recipient}
              </p>
            ) : null}
          </div>

          <div className="field-group">
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              name="subject"
              type="text"
              maxLength={200}
              placeholder="A concise subject"
              value={form.subject}
              aria-invalid={Boolean(fields.subject)}
              aria-describedby={fields.subject ? 'subject-error' : undefined}
              onChange={(event) => updateField('subject', event.target.value)}
            />
            {fields.subject ? (
              <p className="field-error" id="subject-error">
                {fields.subject}
              </p>
            ) : null}
          </div>

          <div className="field-group">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              name="message"
              rows={8}
              maxLength={10000}
              placeholder="Write your message here."
              value={form.message}
              aria-invalid={Boolean(fields.message)}
              aria-describedby={fields.message ? 'message-error' : undefined}
              onChange={(event) => updateField('message', event.target.value)}
            />
            {fields.message ? (
              <p className="field-error" id="message-error">
                {fields.message}
              </p>
            ) : null}
          </div>

          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending...' : 'Send email'}
          </button>

          {statusMessage ? (
            <p className={`form-status form-status-${status}`} role="status" aria-live="polite">
              {statusMessage}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}

function validateForm(form: SendEmailRequest): FormFields {
  const fields: FormFields = {};

  if (!form.recipient.trim()) {
    fields.recipient = 'Recipient is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.recipient.trim())) {
    fields.recipient = 'Enter a valid email address.';
  }

  if (!form.subject.trim()) {
    fields.subject = 'Subject is required.';
  }

  if (!form.message.trim()) {
    fields.message = 'Message is required.';
  }

  return fields;
}

function getErrorMessage(error: Exclude<SendEmailResponse, { ok: true }>['error']) {
  switch (error) {
    case 'email_unconfigured':
      return 'Email sending is not configured for this deployment.';
    case 'rate_limited':
      return 'Too many send attempts. Try again shortly.';
    case 'send_failed':
      return 'The email service could not send this message. Try again shortly.';
    case 'internal_error':
      return 'The email could not be sent. Try again shortly.';
    case 'validation_error':
      return 'Check the highlighted fields and try again.';
  }
}
