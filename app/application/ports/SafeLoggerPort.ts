export type SafeLogLevel = 'info' | 'warn' | 'error';

export type SafeLogValue = string | number | boolean | null | undefined;

export type SafeLogContext = Readonly<Record<string, SafeLogValue>>;

export interface SafeLoggerPort {
  info(message: string, context?: SafeLogContext): void;
  warn(message: string, context?: SafeLogContext): void;
  error(message: string, context?: SafeLogContext): void;
}
