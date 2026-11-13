/**
 * Info page content. Replace the placeholder names with the real team.
 * TODO(credits): fill in real names before release.
 */
export const APP_VERSION = '0.3.0';

export interface CreditGroup {
  role: string;
  /** Empty → shown as "to be announced". */
  names: string[];
}

export const CREDITS: CreditGroup[] = [
  { role: "G'oya va loyiha rahbari", names: [] },
  { role: 'Dasturlash', names: [] },
  { role: 'Dizayn va piksel grafika', names: [] },
  { role: "O'yin balansi va sinov", names: [] },
];
