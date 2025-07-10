/**
 * Centralized logging utility
 * In production, only errors are logged to console
 * In development, all log levels are shown
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const isDevelopment = process.env.NODE_ENV === 'development'

class Logger {
  private log(level: LogLevel, message: string, ...args: any[]) {
    if (!isDevelopment && level !== 'error') {
      return // Only show errors in production
    }

    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`
    
    switch (level) {
      case 'debug':
        console.log(`${prefix} ${message}`, ...args)
        break
      case 'info':
        console.info(`${prefix} ${message}`, ...args)
        break
      case 'warn':
        console.warn(`${prefix} ${message}`, ...args)
        break
      case 'error':
        console.error(`${prefix} ${message}`, ...args)
        break
    }
  }

  debug(message: string, ...args: any[]) {
    this.log('debug', message, ...args)
  }

  info(message: string, ...args: any[]) {
    this.log('info', message, ...args)
  }

  warn(message: string, ...args: any[]) {
    this.log('warn', message, ...args)
  }

  error(message: string, ...args: any[]) {
    this.log('error', message, ...args)
  }

  // Cache-specific logging with emojis for better readability
  cache = {
    hit: (key: string) => this.debug(`🎯 Cache hit for ${key}`),
    miss: (key: string) => this.debug(`🔄 Cache miss, fetching ${key}`),
    invalidate: (prefix: string) => this.debug(`🗑️ Cache invalidated: ${prefix}`),
    cleanup: (count: number) => this.debug(`🧹 Cleaned up ${count} expired cache entries`),
    loaded: (count: number) => this.debug(`📦 Loaded ${count} items from cache`)
  }

  // Component-specific logging
  component = {
    mount: (name: string) => this.debug(`🔧 Component mounted: ${name}`),
    update: (name: string, reason?: string) => this.debug(`🔄 Component updated: ${name}${reason ? ` (${reason})` : ''}`),
    fetch: (name: string, type: string) => this.debug(`📡 ${name} fetching ${type}`)
  }
}

export const logger = new Logger()
export default logger