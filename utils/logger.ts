/**
 * utils/logger.ts — lightweight structured logger for test output.
 *
 * Usage:
 *   const log = createLogger('LoginPage');
 *   log.step('Fill email');
 *   log.info('Token refreshed');
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'STEP' | 'SETUP'

const COLORS: Record<LogLevel, string> = {
	INFO: '\x1b[36m', // cyan
	WARN: '\x1b[33m', // yellow
	ERROR: '\x1b[31m', // red
	STEP: '\x1b[32m', // green
	SETUP: '\x1b[35m', // magenta
}
const RESET = '\x1b[0m'

function format(level: LogLevel, context: string, message: string): string {
	const time = new Date().toISOString().substring(11, 23)
	return `${COLORS[level]}[${level}]${RESET} ${time} [${context}] ${message}`
}

export class Logger {
	constructor(private readonly context: string) {}

	info(message: string): void {
		console.log(format('INFO', this.context, message))
	}

	warn(message: string): void {
		console.warn(format('WARN', this.context, message))
	}

	error(message: string): void {
		console.error(format('ERROR', this.context, message))
	}

	/** Logs a user-visible test action — green in console output. */
	step(message: string): void {
		console.log(format('STEP', this.context, `→ ${message}`))
	}

	/** For messages originating from global-setup. */
	setup(message: string): void {
		console.log(format('SETUP', this.context, message))
	}
}

export const createLogger = (context: string): Logger => new Logger(context)
