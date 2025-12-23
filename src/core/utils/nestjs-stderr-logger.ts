/**
 * Custom NestJS logger that writes all output to stderr.
 * This is required for MCP protocol compliance - only JSON-RPC messages should go to stdout.
 */
import { LoggerService } from '@nestjs/common';

export class NestjsStderrLogger implements LoggerService {
  log(message: any, context?: string) {
    this.writeToStderr('LOG', message, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.writeToStderr('ERROR', message, context, trace);
  }

  warn(message: any, context?: string) {
    this.writeToStderr('WARN', message, context);
  }

  debug(message: any, context?: string) {
    this.writeToStderr('DEBUG', message, context);
  }

  verbose(message: any, context?: string) {
    this.writeToStderr('VERBOSE', message, context);
  }

  private writeToStderr(level: string, message: any, context?: string, trace?: string) {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}] ` : '';
    const traceStr = trace ? `\n${trace}` : '';
    const logMessage = `${timestamp} ${level} ${contextStr}${message}${traceStr}\n`;
    process.stderr.write(logMessage);
  }
}

