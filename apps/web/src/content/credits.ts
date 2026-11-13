/**
 * Info page content. Role titles are translated in the i18n files
 * (creditRoles); names are written as people spell them.
 * TODO(credits): fill in real names before release.
 */
import type { Messages } from '../i18n';

export const APP_VERSION = '0.4.0';

export interface CreditGroup {
  role: keyof Messages['creditRoles'];
  /** Empty → shown as "to be announced". */
  names: string[];
}

export const CREDITS: CreditGroup[] = [
  { role: 'lead', names: [] },
  { role: 'dev', names: [] },
  { role: 'design', names: [] },
  { role: 'balance', names: [] },
];
