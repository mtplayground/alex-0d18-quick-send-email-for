import { useState, type FormEvent } from 'react';

import type { SendEmailRequest, SendEmailResponse } from '../shared/email';

type FormFields = Partial<Record<keyof SendEmailRequest, string>>;
type SendStatus = 'idle' | 'sending' | 'sent' | 'failed';

const maxSubjectLength = 200;
const maxMessageLength = 10000;

const initialForm: SendEmailRequest = {
  recipient: '',
  subject: '',
  message: ''
};

export function App() {
  const [form, setForm] = useState<SendEmailRequest>(initialForm);
  const [fields, setFields] = useState<FormFields>({});
  const [status, setStatus] = useState<SendStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const feedback = getFeedback(status, statusMessage);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = normalizeForm(form);
    const nextFields = validateForm(payload);
    setForm(payload);
    setFields(nextFields);

    if (Object.keys(nextFields).length > 0) {
      setStatus('failed');
      setStatusMessage('Check the highlighted fields and try again.');
      return;
    }

    setStatus('sending');
    setStatusMessage('Sending your email now.');

    try {
      const result = await sendEmail(payload);

      if (result.ok) {
        setForm(initialForm);
        setFields({});
        setStatus('sent');
        setStatusMessage('Your message was accepted by the email service.');
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
              maxLength={maxSubjectLength}
              placeholder="A concise subject"
              value={form.subject}
              aria-invalid={Boolean(fields.subject)}
              aria-describedby={fields.subject ? 'subject-error subject-count' : 'subject-count'}
              onChange={(event) => updateField('subject', event.target.value)}
            />
            <div className="field-meta">
              {fields.subject ? (
                <p className="field-error" id="subject-error">
                  {fields.subject}
                </p>
              ) : (
                <span aria-hidden="true" />
              )}
              <p className="field-count" id="subject-count">
                {form.subject.length}/{maxSubjectLength}
              </p>
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              name="message"
              rows={8}
              maxLength={maxMessageLength}
              placeholder="Write your message here."
              value={form.message}
              aria-invalid={Boolean(fields.message)}
              aria-describedby={fields.message ? 'message-error message-count' : 'message-count'}
              onChange={(event) => updateField('message', event.target.value)}
            />
            <div className="field-meta">
              {fields.message ? (
                <p className="field-error" id="message-error">
                  {fields.message}
                </p>
              ) : (
                <span aria-hidden="true" />
              )}
              <p className="field-count" id="message-count">
                {form.message.length}/{maxMessageLength}
              </p>
            </div>
          </div>

          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending...' : 'Send email'}
          </button>

          {feedback ? (
            <div
              className={`form-feedback form-feedback-${feedback.tone}`}
              role={feedback.tone === 'error' ? 'alert' : 'status'}
              aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}
            >
              <p className="feedback-title">{feedback.title}</p>
              <p className="feedback-message">{feedback.message}</p>
            </div>
          ) : null}
        </form>
      </section>
    </main>
  );
}

function getFeedback(status: SendStatus, message: string) {
  if (status === 'idle') {
    return null;
  }

  if (status === 'sending') {
    return {
      tone: 'pending',
      title: 'Sending',
      message
    } as const;
  }

  if (status === 'sent') {
    return {
      tone: 'success',
      title: 'Email sent',
      message
    } as const;
  }

  return {
    tone: 'error',
    title: 'Email not sent',
    message
  } as const;
}

async function sendEmail(payload: SendEmailRequest): Promise<SendEmailResponse> {
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Expected JSON response from send email API.');
  }

  return (await response.json()) as SendEmailResponse;
}

function normalizeForm(form: SendEmailRequest): SendEmailRequest {
  return {
    recipient: form.recipient.trim(),
    subject: form.subject.trim(),
    message: form.message.trim()
  };
}

function validateForm(form: SendEmailRequest): FormFields {
  const fields: FormFields = {};

  if (!form.recipient) {
    fields.recipient = 'Recipient is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.recipient)) {
    fields.recipient = 'Enter a valid email address.';
  }

  if (!form.subject) {
    fields.subject = 'Subject is required.';
  } else if (form.subject.length > maxSubjectLength) {
    fields.subject = `Subject must be ${maxSubjectLength} characters or fewer.`;
  }

  if (!form.message) {
    fields.message = 'Message is required.';
  } else if (form.message.length > maxMessageLength) {
    fields.message = `Message must be ${maxMessageLength.toLocaleString()} characters or fewer.`;
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
