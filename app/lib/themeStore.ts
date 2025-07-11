import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getGuildTheme, GuildTheme } from './themes';
import { 
  saveTheme, 
  broadcastThemeChange, 
  listenForThemeChanges,
  applyThemeTransition 
} from './themeUtils';

interface ThemeState {
  guildCode: string;
  theme: GuildTheme;
  isTransitioning: boolean;
  history: string[];
  favorites: string[];
  
  // Actions
  setGuildCode: (code: string) => void;
  addToHistory: (code: string) => void;
  toggleFavorite: (code: string) => void;
  clearHistory: () => void;
  setTransitioning: (state: boolean) => void;
}

// Create the theme store with persistence
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      guildCode: 'IW',
      theme: getGuildTheme('IW'),
      isTransitioning: false,
      history: ['IW'],
      favorites: [],
      
      setGuildCode: (code: string) => {
        const state = get();
        if (code === state.guildCode) return;
        
        set({ isTransitioning: true });
        
        applyThemeTransition(() => {
          const newTheme = getGuildTheme(code);
          
          set({
            guildCode: code,
            theme: newTheme,
          });
          
          // Save to external storage
          saveTheme(code);
          broadcastThemeChange(code);
          
          // Add to history
          get().addToHistory(code);
        });
        
        // Reset transition state
        setTimeout(() => {
          set({ isTransitioning: false });
        }, 300);
      },
      
      addToHistory: (code: string) => {
        set((state) => {
          const newHistory = state.history.filter(h => h !== code);
          newHistory.unshift(code);
          
          // Keep only last 10 items
          if (newHistory.length > 10) {
            newHistory.pop();
          }
          
          return { history: newHistory };
        });
      },
      
      toggleFavorite: (code: string) => {
        set((state) => {
          const isFavorite = state.favorites.includes(code);
          const newFavorites = isFavorite
            ? state.favorites.filter(f => f !== code)
            : [...state.favorites, code];
          
          return { favorites: newFavorites };
        });
      },
      
      clearHistory: () => {
        set({ history: [] });
      },
      
      setTransitioning: (isTransitioning: boolean) => {
        set({ isTransitioning });
      },
    }),
    {
      name: 'eot-theme-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        guildCode: state.guildCode,
        history: state.history,
        favorites: state.favorites,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Apply theme after rehydration
          const theme = getGuildTheme(state.guildCode);
          state.theme = theme;
          
          // Apply to document
          if (typeof document !== 'undefined') {
            const root = document.documentElement;
            root.style.setProperty('--primary', theme.primary);
            root.style.setProperty('--secondary', theme.secondary);
            root.style.setProperty('--accent', theme.accent);
            root.style.setProperty('--bg-from', theme.background.from);
            root.style.setProperty('--bg-via', theme.background.via);
            root.style.setProperty('--bg-to', theme.background.to);
            root.style.setProperty('--card-bg', theme.cardBg);
            root.style.setProperty('--card-border', theme.cardBorder);
            root.style.setProperty('--text-primary', theme.text.primary);
            root.style.setProperty('--text-secondary', theme.text.secondary);
            root.style.setProperty('--text-accent', theme.text.accent);
            root.setAttribute('data-theme', state.guildCode);
          }
        }
      },
    }
  )
);

// Initialize cross-tab sync
if (typeof window !== 'undefined') {
  listenForThemeChanges((newCode) => {
    const currentCode = useThemeStore.getState().guildCode;
    if (newCode !== currentCode) {
      useThemeStore.getState().setGuildCode(newCode);
    }
  });
}

// Hook for SSR safety
export function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return isClient;
}

// Selector hooks for common use cases
export const useGuildCode = () => useThemeStore((state) => state.guildCode);
export const useCurrentTheme = () => useThemeStore((state) => state.theme);
export const useIsTransitioning = () => useThemeStore((state) => state.isTransitioning);
export const useThemeHistory = () => useThemeStore((state) => state.history);
export const useFavoriteThemes = () => useThemeStore((state) => state.favorites);

// React import needed for useState/useEffect
import { useState, useEffect } from 'react';