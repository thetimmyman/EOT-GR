// Warhammer 40K Guild Themes
export interface GuildTheme {
  name: string
  primary: string
  secondary: string
  accent: string
  background: {
    from: string
    via: string
    to: string
  }
  cardBg: string
  cardBorder: string
  text: {
    primary: string
    secondary: string
    accent: string
  }
  heraldry?: string
  motto?: string
  pattern?: string
}

export const guildThemes: Record<string, GuildTheme> = {
  // Alpha Legion - Teal/Blue with serpentine patterns
  'AL': {
    name: 'Alpha Legion',
    primary: '#00CED1',      // Dark Turquoise
    secondary: '#008B8B',     // Dark Cyan
    accent: '#20B2AA',        // Light Sea Green
    background: {
      from: '#0F2027',
      via: '#203A43',
      to: '#2C5364'
    },
    cardBg: 'rgba(0, 139, 139, 0.1)',
    cardBorder: 'rgba(0, 206, 209, 0.3)',
    text: {
      primary: '#00CED1',
      secondary: '#B0E0E6',
      accent: '#40E0D0'
    },
    heraldry: '🐍',
    motto: 'Hydra Dominatus',
    pattern: 'scales'
  },

  // Iron Warriors - Iron/Silver with industrial themes
  'IW': {
    name: 'Iron Warriors',
    primary: '#C0C0C0',      // Silver
    secondary: '#696969',     // Dim Gray
    accent: '#FFD700',        // Gold (hazard stripes)
    background: {
      from: '#232526',
      via: '#414345',
      to: '#232526'
    },
    cardBg: 'rgba(105, 105, 105, 0.2)',
    cardBorder: 'rgba(192, 192, 192, 0.3)',
    text: {
      primary: '#C0C0C0',
      secondary: '#A9A9A9',
      accent: '#FFD700'
    },
    heraldry: '⚙️',
    motto: 'Iron Within, Iron Without',
    pattern: 'hazard'
  },

  // Blood Angels - Red/Gold with noble aesthetics
  'BA': {
    name: 'Blood Angels',
    primary: '#DC143C',      // Crimson
    secondary: '#8B0000',     // Dark Red
    accent: '#FFD700',        // Gold
    background: {
      from: '#200122',
      via: '#6f0000',
      to: '#200122'
    },
    cardBg: 'rgba(139, 0, 0, 0.2)',
    cardBorder: 'rgba(220, 20, 60, 0.3)',
    text: {
      primary: '#DC143C',
      secondary: '#FF6B6B',
      accent: '#FFD700'
    },
    heraldry: '🩸',
    motto: 'For the Emperor and Sanguinius!',
    pattern: 'wings'
  },

  // Dark Angels - Dark Green/Bone with monastic themes
  'DA': {
    name: 'Dark Angels',
    primary: '#006400',      // Dark Green
    secondary: '#2F4F2F',     // Dark Slate Gray
    accent: '#F5DEB3',        // Wheat (Deathwing bone)
    background: {
      from: '#0F2027',
      via: '#1B3A1B',
      to: '#0F2027'
    },
    cardBg: 'rgba(0, 100, 0, 0.2)',
    cardBorder: 'rgba(0, 100, 0, 0.3)',
    text: {
      primary: '#228B22',
      secondary: '#90EE90',
      accent: '#F5DEB3'
    },
    heraldry: '⚔️',
    motto: 'Repent! For tomorrow you die!',
    pattern: 'gothic'
  },

  // Thousand Sons - Blue/Gold with mystical themes
  'TS': {
    name: 'Thousand Sons',
    primary: '#4169E1',      // Royal Blue
    secondary: '#191970',     // Midnight Blue
    accent: '#FFD700',        // Gold
    background: {
      from: '#0F0C29',
      via: '#302B63',
      to: '#24243e'
    },
    cardBg: 'rgba(65, 105, 225, 0.1)',
    cardBorder: 'rgba(65, 105, 225, 0.3)',
    text: {
      primary: '#4169E1',
      secondary: '#6495ED',
      accent: '#FFD700'
    },
    heraldry: '🔮',
    motto: 'All is Dust',
    pattern: 'runes'
  },

  // Death Guard - Sickly Green/Rust with decay themes
  'DG': {
    name: 'Death Guard',
    primary: '#6B8E23',      // Olive Drab
    secondary: '#556B2F',     // Dark Olive Green
    accent: '#CD853F',        // Peru (rust)
    background: {
      from: '#1e3c12',
      via: '#2a5217',
      to: '#1e3c12'
    },
    cardBg: 'rgba(107, 142, 35, 0.2)',
    cardBorder: 'rgba(107, 142, 35, 0.3)',
    text: {
      primary: '#9ACD32',
      secondary: '#ADFF2F',
      accent: '#CD853F'
    },
    heraldry: '☠️',
    motto: 'Decay and Rebirth',
    pattern: 'plague'
  },

  // Night Lords - Dark Blue/Lightning with terror themes
  'NL': {
    name: 'Night Lords',
    primary: '#191970',      // Midnight Blue
    secondary: '#000080',     // Navy
    accent: '#87CEEB',        // Sky Blue (lightning)
    background: {
      from: '#000000',
      via: '#0F0F3D',
      to: '#000000'
    },
    cardBg: 'rgba(25, 25, 112, 0.2)',
    cardBorder: 'rgba(25, 25, 112, 0.3)',
    text: {
      primary: '#4169E1',
      secondary: '#6495ED',
      accent: '#87CEEB'
    },
    heraldry: '⚡',
    motto: 'Ave Dominus Nox',
    pattern: 'lightning'
  },

  // World Eaters - Red/Brass with brutal themes
  'WE': {
    name: 'World Eaters',
    primary: '#FF0000',      // Red
    secondary: '#8B0000',     // Dark Red
    accent: '#B87333',        // Copper/Brass
    background: {
      from: '#330000',
      via: '#660000',
      to: '#330000'
    },
    cardBg: 'rgba(139, 0, 0, 0.2)',
    cardBorder: 'rgba(255, 0, 0, 0.3)',
    text: {
      primary: '#FF0000',
      secondary: '#FF6B6B',
      accent: '#B87333'
    },
    heraldry: '🩸',
    motto: 'Blood for the Blood God!',
    pattern: 'chainaxe'
  },

  // Space Wolves - Grey/Blue with wolf themes
  'SW': {
    name: 'Space Wolves',
    primary: '#708090',      // Slate Gray
    secondary: '#2F4F4F',     // Dark Slate Gray
    accent: '#87CEEB',        // Sky Blue
    background: {
      from: '#141E30',
      via: '#243B55',
      to: '#141E30'
    },
    cardBg: 'rgba(112, 128, 144, 0.2)',
    cardBorder: 'rgba(112, 128, 144, 0.3)',
    text: {
      primary: '#B0C4DE',
      secondary: '#E6E6FA',
      accent: '#87CEEB'
    },
    heraldry: '🐺',
    motto: 'For Russ and the Allfather!',
    pattern: 'fangs'
  },

  // Imperial Fists - Yellow/Black with fortification themes
  'IF': {
    name: 'Imperial Fists',
    primary: '#FFD700',      // Gold
    secondary: '#FFA500',     // Orange
    accent: '#000000',        // Black
    background: {
      from: '#3D2817',
      via: '#5C4033',
      to: '#3D2817'
    },
    cardBg: 'rgba(255, 215, 0, 0.1)',
    cardBorder: 'rgba(255, 215, 0, 0.3)',
    text: {
      primary: '#FFD700',
      secondary: '#FFFFE0',
      accent: '#FFA500'
    },
    heraldry: '🏰',
    motto: 'Primarch-Progenitor',
    pattern: 'fortress'
  },

  // Raven Guard - Black/Dark with stealth themes
  'RG': {
    name: 'Raven Guard',
    primary: '#1C1C1C',      // Very Dark Gray
    secondary: '#000000',     // Black
    accent: '#FFFFFF',        // White
    background: {
      from: '#000000',
      via: '#1a1a1a',
      to: '#000000'
    },
    cardBg: 'rgba(28, 28, 28, 0.3)',
    cardBorder: 'rgba(255, 255, 255, 0.1)',
    text: {
      primary: '#FFFFFF',
      secondary: '#C0C0C0',
      accent: '#808080'
    },
    heraldry: '🦅',
    motto: 'Victorus aut Mortis',
    pattern: 'shadow'
  },

  // Salamanders - Green/Black with fire themes
  'SAL': {
    name: 'Salamanders',
    primary: '#228B22',      // Forest Green
    secondary: '#006400',     // Dark Green
    accent: '#FF4500',        // Orange Red (fire)
    background: {
      from: '#0a0e0a',
      via: '#1a3a1a',
      to: '#0a0e0a'
    },
    cardBg: 'rgba(34, 139, 34, 0.2)',
    cardBorder: 'rgba(34, 139, 34, 0.3)',
    text: {
      primary: '#32CD32',
      secondary: '#98FB98',
      accent: '#FF6347'
    },
    heraldry: '🔥',
    motto: 'Into the fires of battle',
    pattern: 'flames'
  },

  // Ultramarines - Blue/Gold with roman themes
  'UM': {
    name: 'Ultramarines',
    primary: '#0047AB',      // Cobalt Blue
    secondary: '#002FA7',     // International Klein Blue
    accent: '#FFD700',        // Gold
    background: {
      from: '#000428',
      via: '#004e92',
      to: '#000428'
    },
    cardBg: 'rgba(0, 71, 171, 0.2)',
    cardBorder: 'rgba(0, 71, 171, 0.3)',
    text: {
      primary: '#4169E1',
      secondary: '#87CEEB',
      accent: '#FFD700'
    },
    heraldry: '🛡️',
    motto: 'Courage and Honour',
    pattern: 'aquila'
  },

  // Default theme for unknown guilds
  'DEFAULT': {
    name: 'Imperial',
    primary: '#FFD700',
    secondary: '#C0C0C0',
    accent: '#FFFFFF',
    background: {
      from: '#1a1a2e',
      via: '#16213e',
      to: '#0f3460'
    },
    cardBg: 'rgba(255, 255, 255, 0.05)',
    cardBorder: 'rgba(255, 255, 255, 0.1)',
    text: {
      primary: '#FFFFFF',
      secondary: '#E0E0E0',
      accent: '#FFD700'
    },
    heraldry: '⚜️',
    motto: 'For the Emperor!',
    pattern: 'imperial'
  },

  // The Heresy Lodge - Purple/Black with lodge themes
  'HL': {
    name: 'The Heresy Lodge',
    primary: '#4B0082',      // Indigo
    secondary: '#2F1B69',     // Dark Purple
    accent: '#9370DB',        // Medium Purple
    background: {
      from: '#1a0933',
      via: '#2d1b4e',
      to: '#1a0933'
    },
    cardBg: 'rgba(75, 0, 130, 0.2)',
    cardBorder: 'rgba(75, 0, 130, 0.3)',
    text: {
      primary: '#9370DB',
      secondary: '#BA55D3',
      accent: '#DDA0DD'
    },
    heraldry: '🌙',
    motto: 'In Shadow We Trust',
    pattern: 'lodge'
  },

  // Iron Hydras - Dark Steel/Green with hydra themes
  'IH': {
    name: 'Iron Hydras',
    primary: '#2F4F4F',      // Dark Slate Gray
    secondary: '#556B2F',     // Dark Olive Green
    accent: '#00CED1',        // Dark Turquoise
    background: {
      from: '#0f1419',
      via: '#1e3a1e',
      to: '#0f1419'
    },
    cardBg: 'rgba(47, 79, 79, 0.2)',
    cardBorder: 'rgba(47, 79, 79, 0.3)',
    text: {
      primary: '#708090',
      secondary: '#B0C4DE',
      accent: '#20B2AA'
    },
    heraldry: '🐍',
    motto: 'Hydra Eternal',
    pattern: 'hydra'
  }
}

export function getGuildTheme(guildCode: string): GuildTheme {
  return guildThemes[guildCode] || guildThemes['DEFAULT']
}