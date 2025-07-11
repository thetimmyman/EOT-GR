// Theme utility functions for enhanced theme management
export interface ThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
  background: {
    from: string;
    via: string;
    to: string;
  };
  card: {
    bg: string;
    border: string;
  };
  text: {
    primary: string;
    secondary: string;
    accent: string;
  };
  heraldry?: string;
  motto?: string;
  pattern?: string;
}

// Validate theme configuration
export const validateTheme = (theme: unknown): theme is ThemeConfig => {
  if (typeof theme !== 'object' || theme === null) return false;
  
  const t = theme as any;
  return (
    typeof t.primary === 'string' &&
    typeof t.secondary === 'string' &&
    typeof t.accent === 'string' &&
    typeof t.background === 'object' &&
    typeof t.background.from === 'string' &&
    typeof t.background.via === 'string' &&
    typeof t.background.to === 'string' &&
    typeof t.card === 'object' &&
    typeof t.card.bg === 'string' &&
    typeof t.card.border === 'string' &&
    typeof t.text === 'object' &&
    typeof t.text.primary === 'string' &&
    typeof t.text.secondary === 'string' &&
    typeof t.text.accent === 'string'
  );
};

// Format boss names with level indicators
export function formatBossName(name: string, set: number, tier?: number): string {
  // Ensure set is a valid number
  const level = typeof set === 'number' ? `L${set + 1}` : 'L?';
  return `${level} ${name}`;
}

// Check if a record is a boss (not a prime)
export function isBoss(encounterId: number): boolean {
  return encounterId === 0;
}

// Check if a record is a prime
export function isPrime(encounterId: number): boolean {
  return encounterId > 0;
}

// Get theme from various sources with fallback
export function getStoredTheme(): string | null {
  // Try localStorage first
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('guild-theme');
    if (stored) return stored;
  }
  
  // Try cookies
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/theme=([^;]+)/);
    if (match) return match[1];
  }
  
  return null;
}

// Save theme to multiple storage locations
export function saveTheme(theme: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('guild-theme', theme);
    localStorage.setItem('theme-timestamp', Date.now().toString());
  }
  
  if (typeof document !== 'undefined') {
    document.cookie = `theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
  }
}

// Apply theme with smooth transition
export function applyThemeTransition(callback: () => void): void {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.transition = 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)';
    
    callback();
    
    // Remove transition after animation
    setTimeout(() => {
      root.style.transition = '';
    }, 300);
  } else {
    callback();
  }
}

// Broadcast theme change to other tabs
export function broadcastThemeChange(theme: string): void {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    const channel = new BroadcastChannel('theme-sync');
    channel.postMessage({ type: 'theme-change', theme });
    channel.close();
  }
}

// Listen for theme changes from other tabs
export function listenForThemeChanges(callback: (theme: string) => void): () => void {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    const channel = new BroadcastChannel('theme-sync');
    const handler = (event: MessageEvent) => {
      if (event.data.type === 'theme-change') {
        callback(event.data.theme);
      }
    };
    channel.addEventListener('message', handler);
    
    return () => {
      channel.removeEventListener('message', handler);
      channel.close();
    };
  }
  
  return () => {};
}

// Format number with K/M suffixes
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Calculate lost tokens correctly
export function calculateLostTokens(playerTokenCounts: Record<string, number>): number {
  const tokenValues = Object.values(playerTokenCounts);
  if (tokenValues.length === 0) return 0;
  
  const maxPlayerTokens = Math.max(...tokenValues);
  
  return Object.entries(playerTokenCounts).reduce((total, [player, tokens]) => {
    const lost = maxPlayerTokens - 3 - tokens;
    return total + (lost > 0 ? lost : 0);
  }, 0);
}

// Group data by boss including primes
export function groupByBossWithPrimes(data: any[]): Map<string, any[]> {
  const grouped = new Map<string, any[]>();
  
  data.forEach(item => {
    const key = formatBossName(item.Name, item.set);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(item);
  });
  
  return grouped;
}

// Calculate cluster average excluding a specific guild
export function calculateClusterAverage(
  data: any[], 
  excludeGuild: string, 
  field: string = 'damageDealt'
): number {
  const filtered = data.filter(item => item.Guild !== excludeGuild);
  if (filtered.length === 0) return 0;
  
  const sum = filtered.reduce((acc, item) => acc + (item[field] || 0), 0);
  return sum / filtered.length;
}

// Check if system prefers dark mode
export function getSystemThemePreference(): 'dark' | 'light' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark'; // Default to dark for Warhammer theme
}

// Debounce function for theme switching
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}