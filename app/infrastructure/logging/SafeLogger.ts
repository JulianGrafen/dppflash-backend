import type { SafeLoggerPort, SafeLogContext } from '@/app/application/ports/SafeLoggerPort';

const REDACTED = '[redacted]';

const SENSITIVE_KEY_PATTERNS = [
  /name/i,
  /email/i,
  /address/i,
  /phone/i,
  /fileName/i,
  /text/i,
  /content/i,
  /raw/i,
  /apiKey/i,
  /token/i,
];

function sanitizeContext(context: SafeLogContext = {}): SafeLogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      const shouldRedact = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      return [key, shouldRedact ? REDACTED : value];
    }),
  );
}

export class SafeLogger implements SafeLoggerPort {
  info(message: string, context?: SafeLogContext): void {
    console.info(`[DPP] ${message}`, sanitizeContext(context));
  }

  warn(message: string, context?: SafeLogContext): void {
    console.warn(`[DPP] ${message}`, sanitizeContext(context));
  }

  error(message: string, context?: SafeLogContext): void {
    console.error(`[DPP] ${message}`, sanitizeContext(context));
  }
}
