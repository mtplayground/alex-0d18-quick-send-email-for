import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type EmailServiceConfig = {
  url: string;
  appToken: string;
};

export type ServerConfig = {
  nodeEnv: string;
  host: '0.0.0.0';
  port: number;
  selfUrl?: string;
  allowedCorsOrigin?: string;
  emailService: EmailServiceConfig | null;
};

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const projectRoot = path.resolve(currentDir, '../..');

loadEnvironmentFiles();

export const serverConfig: ServerConfig = {
  nodeEnv: readString('NODE_ENV') ?? 'development',
  host: '0.0.0.0',
  port: readPort(process.env.PORT),
  selfUrl: readString('SELF_URL'),
  allowedCorsOrigin: readString('ALLOWED_CORS_ORIGIN'),
  emailService: readEmailServiceConfig()
};

function loadEnvironmentFiles() {
  const nodeEnv = process.env.NODE_ENV?.trim();
  const files = ['.env', '.env.local'];

  if (nodeEnv) {
    files.push(`.env.${nodeEnv}`, `.env.${nodeEnv}.local`);
  }

  for (const file of files) {
    loadDotenv({ path: path.join(projectRoot, file), override: false });
  }
}

function readString(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readPort(value: string | undefined): number {
  if (!value) {
    return 8080;
  }

  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

function readEmailServiceConfig(): EmailServiceConfig | null {
  const url = readString('MCTAI_EMAIL_URL');
  const appToken = readString('MCTAI_EMAIL_APP_TOKEN');

  if (!url) {
    return null;
  }

  if (!appToken) {
    throw new Error('MCTAI_EMAIL_APP_TOKEN is required when MCTAI_EMAIL_URL is set');
  }

  return { url, appToken };
}
