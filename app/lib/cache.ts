'use client'

import { CACHE_DURATIONS } from './config'

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
}

interface CacheConfig {
  defaultTTL: number
  maxSize: number
}

class CacheManager {
  private cache = new Map<string, CacheItem<any>>()
  private config: CacheConfig = {
    defaultTTL: 5 * 60 * 1000, // 5 minutes default
    maxSize: 100
  }

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
    
    // Load from localStorage on initialization
    this.loadFromStorage()
    
    // Set up periodic cleanup (client-side only)
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), 60 * 1000) // Clean every minute
    }
  }

  private generateKey(prefix: string, params: Record<string, any> = {}): string {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|')
    return paramString ? `${prefix}::${paramString}` : prefix
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now()
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: now,
      ttl: ttl || this.config.defaultTTL
    }

    // If cache is full, remove oldest item
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0][0]
      this.cache.delete(oldestKey)
    }

    this.cache.set(key, cacheItem)
    this.saveToStorage()
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) {
      return null
    }

    const now = Date.now()
    const isExpired = (now - item.timestamp) > item.ttl

    if (isExpired) {
      this.cache.delete(key)
      this.saveToStorage()
      return null
    }

    return item.data
  }

  // Specific methods for common cache patterns
  async getOrFetch<T>(
    prefix: string, 
    fetchFn: () => Promise<T>, 
    params: Record<string, any> = {},
    ttl?: number
  ): Promise<T> {
    const key = this.generateKey(prefix, params)
    const cached = this.get<T>(key)
    
    if (cached !== null) {
      // Only log cache hits in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🎯 Cache hit for ${key}`)
      }
      return cached
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Cache miss, fetching ${key}`)
    }
    const data = await fetchFn()
    this.set(key, data, ttl)
    return data
  }

  // Clear specific cache entries
  invalidate(prefix: string, params: Record<string, any> = {}): void {
    const key = this.generateKey(prefix, params)
    this.cache.delete(key)
    this.saveToStorage()
  }

  // Clear all cache entries with a specific prefix
  invalidatePrefix(prefix: string): void {
    const keysToDelete = Array.from(this.cache.keys())
      .filter(key => key.startsWith(prefix))
    
    keysToDelete.forEach(key => this.cache.delete(key))
    this.saveToStorage()
  }

  // Clear all cache
  clear(): void {
    this.cache.clear()
    this.saveToStorage()
  }

  private cleanup(): void {
    const now = Date.now()
    const expiredKeys = Array.from(this.cache.entries())
      .filter(([, item]) => (now - item.timestamp) > item.ttl)
      .map(([key]) => key)

    expiredKeys.forEach(key => this.cache.delete(key))
    
    if (expiredKeys.length > 0 && process.env.NODE_ENV === 'development') {
      console.log(`🧹 Cleaned up ${expiredKeys.length} expired cache entries`)
      this.saveToStorage()
    }
  }

  private saveToStorage(): void {
    try {
      // Check if localStorage is available (client-side only)
      if (typeof window !== 'undefined' && window.localStorage) {
        const cacheData = Array.from(this.cache.entries())
        localStorage.setItem('eot_app_cache', JSON.stringify(cacheData))
      }
    } catch (error) {
      console.warn('Failed to save cache to localStorage:', error)
    }
  }

  private loadFromStorage(): void {
    try {
      // Check if localStorage is available (client-side only)
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem('eot_app_cache')
        if (stored) {
          const cacheData = JSON.parse(stored)
          this.cache = new Map(cacheData)
          if (process.env.NODE_ENV === 'development') {
            console.log(`📦 Loaded ${this.cache.size} items from cache`)
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error)
      this.cache.clear()
    }
  }

  // Get cache statistics
  getStats() {
    const now = Date.now()
    const items = Array.from(this.cache.values())
    const expired = items.filter(item => (now - item.timestamp) > item.ttl).length
    
    return {
      total: this.cache.size,
      expired,
      active: this.cache.size - expired,
      memoryUsage: JSON.stringify(Array.from(this.cache.entries())).length
    }
  }
}

// Cache TTL constants
export const CACHE_TTL = CACHE_DURATIONS

// Global cache instance - optimized for production use
export const cache = new CacheManager({
  defaultTTL: 10 * 60 * 1000, // 10 minutes default for better performance
  maxSize: 200 // Increased size to handle more cached queries
})

// Specific cache functions for common operations
export const cacheUtils = {
  // Guild configuration caching
  getGuildConfig: (params: Record<string, any> = {}) => 
    cache.getOrFetch('guild_config', async () => {
      // This will be replaced with actual fetch function
      throw new Error('Fetch function not implemented')
    }, params, CACHE_TTL.GUILD_CONFIG),

  // Season data caching  
  getSeasons: () =>
    cache.getOrFetch('seasons', async () => {
      throw new Error('Fetch function not implemented')
    }, {}, CACHE_TTL.SEASONS),

  // Clear guild-related cache when data changes
  invalidateGuildData: () => {
    cache.invalidatePrefix('guild_config')
    cache.invalidatePrefix('guild_options')
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Invalidated guild cache')
    }
  },

  // Clear season-related cache
  invalidateSeasonData: (season?: string) => {
    if (season) {
      cache.invalidatePrefix(`season_${season}`)
    } else {
      cache.invalidatePrefix('season')
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Invalidated season cache')
    }
  },

  // Get cache stats for debugging
  getStats: () => cache.getStats()
}

export default cache