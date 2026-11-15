/**
 * The academy league (docs/LEAGUE.md): 16 fixed, fictional academies. Every
 * career starts at Etiqod Akademiyasi — "e'tiqod" is faith, belief: the hero
 * left everything behind on belief alone. Motto: "Ishonch — birinchi qadam."
 *
 * The names nod to famous academies but none is a real club; every club has
 * its own kit and its own drawn crest (no real badges or logos).
 */
import type { ClubStyle, Kit } from './types';

export interface ClubProfile {
  /** Stable id of the club. */
  key: string;
  name: string;
  kit: Kit;
  /** Target average OVR of the squad. */
  ovr: number;
  style: ClubStyle;
}

export const ETIQOD = 'etiqod';

export const ACADEMY_CLUBS: ClubProfile[] = [
  { key: 'etiqod', name: 'Etiqod Akademiyasi', ovr: 57, style: 'disciplined', kit: { shirt: '#6CABDD', secondary: '#FFFFFF', shorts: '#FFFFFF', socks: '#6CABDD', pattern: 'plain' } },
  { key: 'masiya', name: 'Masiya Akademiyasi', ovr: 59, style: 'possession', kit: { shirt: '#9B1B4A', secondary: '#1E3A8A', shorts: '#1E3A8A', socks: '#9B1B4A', pattern: 'stripes' } },
  { key: 'valdebella', name: 'Valdebella', ovr: 60, style: 'stars', kit: { shirt: '#F5F5F5', secondary: '#C9A227', shorts: '#F5F5F5', socks: '#F5F5F5', pattern: 'trim' } },
  { key: 'detokomsta', name: 'De Tokomsta', ovr: 60, style: 'technical', kit: { shirt: '#FFFFFF', secondary: '#D2122E', shorts: '#FFFFFF', socks: '#FFFFFF', pattern: 'band' } },
  { key: 'kirkvale', name: 'Kirkvale', ovr: 59, style: 'press', kit: { shirt: '#C8102E', secondary: '#FFFFFF', shorts: '#C8102E', socks: '#C8102E', pattern: 'plain' } },
  { key: 'cobhill', name: 'Cobhill', ovr: 59, style: 'physical', kit: { shirt: '#1B4FA0', secondary: '#FFFFFF', shorts: '#1B4FA0', socks: '#FFFFFF', pattern: 'plain' } },
  { key: 'kraftberg', name: 'Kraftberg Akademie', ovr: 59, style: 'intense', kit: { shirt: '#F26B1D', secondary: '#14213D', shorts: '#14213D', socks: '#F26B1D', pattern: 'shoulders' } },
  { key: 'clairmont', name: 'Clairmont', ovr: 61.5, style: 'athletic', kit: { shirt: '#0B1F4B', secondary: '#B8C2CC', shorts: '#0B1F4B', socks: '#0B1F4B', pattern: 'trim' } },
  { key: 'lezana', name: 'Lezana', ovr: 58, style: 'stubborn', kit: { shirt: '#B71C1C', secondary: '#111111', shorts: '#111111', socks: '#111111', pattern: 'plain' } },
  { key: 'alcova', name: 'Alcova', ovr: 58, style: 'wings', kit: { shirt: '#00875A', secondary: '#111111', shorts: '#111111', socks: '#00875A', pattern: 'hoops' } },
  { key: 'haleridge', name: 'Hale Ridge', ovr: 58, style: 'combination', kit: { shirt: '#5B2A86', secondary: '#FFFFFF', shorts: '#FFFFFF', socks: '#5B2A86', pattern: 'sleeves' } },
  { key: 'aspira', name: 'Aspira Akademiyasi', ovr: 57, style: 'modern', kit: { shirt: '#7A1F3D', secondary: '#E8D3B0', shorts: '#7A1F3D', socks: '#7A1F3D', pattern: 'plain' } },
  { key: 'paxtazor', name: 'Paxtazor', ovr: 57, style: 'traditional', kit: { shirt: '#1E8E3E', secondary: '#FFFFFF', shorts: '#FFFFFF', socks: '#1E8E3E', pattern: 'collar' } },
  { key: 'bunyodlar', name: 'Bunyodlar', ovr: 56, style: 'chaotic', kit: { shirt: '#FFC72C', secondary: '#0057B8', shorts: '#0057B8', socks: '#FFC72C', pattern: 'plain' } },
  { key: 'brightdream', name: 'Brightdream Academy', ovr: 55, style: 'raw', kit: { shirt: '#FFD400', secondary: '#111111', shorts: '#111111', socks: '#FFD400', pattern: 'halves' } },
  { key: 'turon', name: 'Turon Akademiyasi', ovr: 55, style: 'underdog', kit: { shirt: '#1FB5AD', secondary: '#FFFFFF', shorts: '#FFFFFF', socks: '#1FB5AD', pattern: 'trim' } },
];

/** A plain kit for clubs of the other leagues (generated). */
export function plainKit(color: string, light: boolean): Kit {
  return { shirt: color, secondary: '#FFFFFF', shorts: light ? '#1D2433' : '#FFFFFF', socks: color, pattern: 'plain' };
}

const lightHex = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170;
};

/** The club's home kit (older saves have only a colour). */
export const clubKit = (c: { color: string; kit?: Kit }): Kit => c.kit ?? plainKit(c.color, lightHex(c.color));
