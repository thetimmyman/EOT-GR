'use client';

import React, { useState, useEffect } from 'react';
import { themes } from '@/app/lib/themes';
import { useTheme } from './EnhancedThemeProvider';
import { Check, Palette, X } from 'lucide-react';

interface ThemePickerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemePicker({ isOpen, onClose }: ThemePickerProps) {
  const { guildCode, setGuildCode, isTransitioning } = useTheme();
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter themes based on search
  const filteredThemes = Object.entries(themes).filter(([code, theme]) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      code.toLowerCase().includes(searchLower) ||
      theme.motto?.toLowerCase().includes(searchLower) ||
      code === 'DEFAULT'
    );
  });

  // Group themes by category
  const categorizedThemes = {
    traitor: filteredThemes.filter(([code]) => 
      ['AL', 'IW', 'NL', 'WE', 'DG', 'TS', 'HL'].includes(code)
    ),
    loyalist: filteredThemes.filter(([code]) => 
      ['BA', 'DA', 'SW', 'IF', 'RG', 'SAL', 'UM', 'IH'].includes(code)
    ),
    other: filteredThemes.filter(([code]) => code === 'DEFAULT')
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div 
        className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 
                   md:max-w-4xl md:max-h-[80vh] w-full bg-slate-900 rounded-xl shadow-2xl z-[101] 
                   overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-picker-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Palette className="w-6 h-6 text-amber-400" />
            <h2 id="theme-picker-title" className="text-2xl font-bold text-amber-400">
              Choose Your Allegiance
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close theme picker"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-700">
          <input
            type="text"
            placeholder="Search legions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg 
                     text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400
                     transition-colors"
          />
        </div>

        {/* Theme Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Traitor Legions */}
          {categorizedThemes.traitor.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-red-400 mb-4">Traitor Legions</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {categorizedThemes.traitor.map(([code, theme]) => (
                  <ThemeCard
                    key={code}
                    code={code}
                    theme={theme}
                    isSelected={guildCode === code}
                    isHovered={hoveredTheme === code}
                    onSelect={() => {
                      setGuildCode(code);
                      setTimeout(onClose, 300);
                    }}
                    onHover={() => setHoveredTheme(code)}
                    onLeave={() => setHoveredTheme(null)}
                    disabled={isTransitioning}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Loyalist Legions */}
          {categorizedThemes.loyalist.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-blue-400 mb-4">Loyalist Legions</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {categorizedThemes.loyalist.map(([code, theme]) => (
                  <ThemeCard
                    key={code}
                    code={code}
                    theme={theme}
                    isSelected={guildCode === code}
                    isHovered={hoveredTheme === code}
                    onSelect={() => {
                      setGuildCode(code);
                      setTimeout(onClose, 300);
                    }}
                    onHover={() => setHoveredTheme(code)}
                    onLeave={() => setHoveredTheme(null)}
                    disabled={isTransitioning}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other */}
          {categorizedThemes.other.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-amber-400 mb-4">Imperial Standard</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {categorizedThemes.other.map(([code, theme]) => (
                  <ThemeCard
                    key={code}
                    code={code}
                    theme={theme}
                    isSelected={guildCode === code}
                    isHovered={hoveredTheme === code}
                    onSelect={() => {
                      setGuildCode(code);
                      setTimeout(onClose, 300);
                    }}
                    onHover={() => setHoveredTheme(code)}
                    onLeave={() => setHoveredTheme(null)}
                    disabled={isTransitioning}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface ThemeCardProps {
  code: string;
  theme: any;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: () => void;
  onLeave: () => void;
  disabled?: boolean;
}

function ThemeCard({ code, theme, isSelected, isHovered, onSelect, onHover, onLeave, disabled }: ThemeCardProps) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      disabled={disabled}
      className={`
        relative p-4 rounded-lg border-2 transition-all duration-300 
        ${isSelected ? 'border-amber-400 bg-slate-800' : 'border-slate-700 bg-slate-800/50'}
        ${isHovered && !isSelected ? 'border-slate-600 transform scale-105' : ''}
        ${disabled ? 'opacity-50 cursor-wait' : 'hover:shadow-lg cursor-pointer'}
        focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900
      `}
      role="radio"
      aria-checked={isSelected}
      aria-label={`${code} theme - ${theme.motto || 'No motto'}`}
    >
      {/* Color Preview */}
      <div className="flex gap-1 mb-3">
        <div 
          className="w-8 h-8 rounded"
          style={{ backgroundColor: theme.primary }}
          aria-hidden="true"
        />
        <div 
          className="w-8 h-8 rounded"
          style={{ backgroundColor: theme.secondary }}
          aria-hidden="true"
        />
        <div 
          className="w-8 h-8 rounded"
          style={{ backgroundColor: theme.accent }}
          aria-hidden="true"
        />
      </div>

      {/* Legion Info */}
      <div className="text-left">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{theme.heraldry || '⚔️'}</span>
          <span className="font-bold text-sm" style={{ color: theme.text.primary }}>
            {code}
          </span>
        </div>
        <p className="text-xs text-slate-400 line-clamp-2">
          {theme.motto || 'For the Emperor!'}
        </p>
      </div>

      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-amber-400 rounded-full 
                      flex items-center justify-center">
          <Check className="w-4 h-4 text-slate-900" />
        </div>
      )}
    </button>
  );
}

// Compact theme picker for mobile/header
export function CompactThemePicker() {
  const { guildCode, setGuildCode, availableThemes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 
                 hover:bg-slate-700 transition-colors"
        aria-label="Open theme picker"
        aria-expanded={isOpen}
      >
        <div 
          className="w-4 h-4 rounded"
          style={{ backgroundColor: availableThemes[guildCode]?.primary || '#666' }}
        />
        <span className="text-sm font-medium">{guildCode}</span>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full mt-2 right-0 w-64 max-h-96 overflow-y-auto
                        bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
            {Object.entries(availableThemes).map(([code, theme]) => (
              <button
                key={code}
                onClick={() => {
                  setGuildCode(code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800
                         transition-colors ${guildCode === code ? 'bg-slate-800' : ''}`}
              >
                <div className="flex gap-1">
                  <div 
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: theme.primary }}
                  />
                  <div 
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: theme.secondary }}
                  />
                </div>
                <span className="text-sm font-medium">{code}</span>
                {guildCode === code && (
                  <Check className="w-4 h-4 text-amber-400 ml-auto" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}