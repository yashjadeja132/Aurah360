/** Warm premium clinic palette — deep green primary, cream base, soft accent tints. */
export const colors = {
  background: '#F7F1E6',
  backgroundAlt: '#F1E8D8',
  card: '#FFFFFF',
  foreground: '#16261D',
  foregroundSoft: '#3A4A3F',
  primary: '#1E5A40',
  primaryDark: '#123D2A',
  primaryLight: '#2F7A57',
  primaryForeground: '#FAF6EF',
  accent: '#C98A3B',
  accentSoft: '#FBEEDD',
  accentForeground: '#5A3A12',
  muted: '#ECE2CC',
  mutedForeground: '#75705F',
  border: '#E6DAC0',
  success: '#1E7A4C',
  successSoft: '#E3F3E9',
  warning: '#B4650F',
  warningSoft: '#FBEEDD',
  destructive: '#B3261E',
  destructiveSoft: '#FBE9E7',
  info: '#2B6CB0',
  infoSoft: '#E7F0FA',
  white: '#FFFFFF',
};

export const gradients = {
  hero: ['#123D2A', '#1E5A40', '#2F7A57'],
  gold: ['#C98A3B', '#E0AA5C'],
};

export const radii = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const shadow = {
  card: {
    shadowColor: '#123D2A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  floating: {
    shadowColor: '#123D2A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
};

export default colors;
