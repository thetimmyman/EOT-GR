'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getGuildTheme, GuildTheme, themes } from '@/app/lib/themes';
import {
  getStoredTheme,
  saveTheme,
  applyThemeTransition,
  broadcastThemeChange,
  listenForThemeChanges,
  validateTheme,
  debounce
} from '@/app/lib/themeUtils';

interface ThemeContextType {
  theme: GuildTheme;
  guildCode: string;
  setGuildCode: (code: string) => void;
  availableThemes: typeof themes;
  isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function EnhancedThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize with stored theme or default
  const [guildCode, setGuildCodeState] = useState<string>(() => {
    const stored = getStoredTheme();
    return stored || 'IW';
  });
  
  const [theme, setTheme] = useState<GuildTheme>(() => getGuildTheme(guildCode));
  const [isTransitioning, setIsTransitioning] = useState(false);
  const mountedRef = useRef(true);
  const transitionTimeoutRef = useRef<NodeJS.Timeout>();

  // Apply CSS variables with performance optimization
  const applyCSSVariables = useCallback((theme: GuildTheme) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      
      // Batch all CSS variable updates
      const updates = {
        '--primary': theme.primary,
        '--secondary': theme.secondary,
        '--accent': theme.accent,
        '--bg-from': theme.background.from,
        '--bg-via': theme.background.via,
        '--bg-to': theme.background.to,
        '--card-bg': theme.cardBg,
        '--card-border': theme.cardBorder,
        '--text-primary': theme.text.primary,
        '--text-secondary': theme.text.secondary,
        '--text-accent': theme.text.accent,
      };

      // Apply all updates in a single reflow
      Object.entries(updates).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });

      // Set data attribute for theme-specific CSS
      root.setAttribute('data-theme', guildCode);
    }
  }, [guildCode]);

  // Debounced theme setter to prevent rapid switching
  const debouncedSetGuildCode = useCallback(
    debounce((code: string) => {
      if (!mountedRef.current) return;
      
      setIsTransitioning(true);
      
      applyThemeTransition(() => {
        const newTheme = getGuildTheme(code);
        
        if (validateTheme(newTheme)) {
          setGuildCodeState(code);
          setTheme(newTheme);
          saveTheme(code);
          broadcastThemeChange(code);
          applyCSSVariables(newTheme);
        }
      });

      // Clear any existing timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      // Reset transition state after animation
      transitionTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setIsTransitioning(false);
        }
      }, 300);
    }, 50),
    [applyCSSVariables]
  );

  // Listen for theme changes from other tabs
  useEffect(() => {
    const cleanup = listenForThemeChanges((newCode) => {
      if (newCode !== guildCode && mountedRef.current) {
        debouncedSetGuildCode(newCode);
      }
    });

    return cleanup;
  }, [guildCode, debouncedSetGuildCode]);

  // Apply theme on mount and changes
  useEffect(() => {
    applyCSSVariables(theme);
  }, [theme, applyCSSVariables]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // Handle storage events for cross-tab sync (fallback for older browsers)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'guild-theme' && e.newValue && e.newValue !== guildCode) {
        debouncedSetGuildCode(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [guildCode, debouncedSetGuildCode]);

  const value: ThemeContextType = {
    theme,
    guildCode,
    setGuildCode: debouncedSetGuildCode,
    availableThemes: themes,
    isTransitioning
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within EnhancedThemeProvider');
  }
  return context;
}

// Export a hook for checking if theme is ready (for SSR)
export function useIsThemeReady(): boolean {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    setIsReady(true);
  }, []);
  
  return isReady;
}