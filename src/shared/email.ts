export type SendEmailRequest = {
  recipient: string;
  subject: string;
  message: string;
};

export type SendEmailSuccessResponse = {
  ok: true;
};

export type SendEmailErrorResponse = {
  ok: false;
  error: 'validation_error' | 'send_failed' | 'internal_error';
  fields?: Partial<Record<keyof SendEmailRequest, string>>;
};

export type SendEmailResponse = SendEmailSuccessResponse | SendEmailErrorResponse;
