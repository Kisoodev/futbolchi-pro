import type { Club, Match, MatchEvent } from '@futbolchi/engine';
import { tx } from './index';

/** Human-readable line for a match event, in the current language. */
export function eventText(e: MatchEvent, m: Match, clubs: Record<string, Club>, personaName: string): string {
  const club = clubs[e.team === 'home' ? m.homeId : m.awayId].name;
  const me = e.actor === 'persona';
  const assist = e.detail?.assistByPersona ? tx.ev.assistBy(personaName) : '';
  const red = e.detail?.card === 'red';
  switch (e.type) {
    case 'goal':
      return me ? tx.ev.goalMe(personaName) : tx.ev.goalTeam(club) + assist;
    case 'keyChance':
      return me ? tx.ev.shotMe(personaName, !!e.detail?.saved) : tx.ev.chanceTeam(club, !!e.detail?.saved) + assist;
    case 'save':
      return tx.ev.save(personaName);
    case 'card':
      return me ? tx.ev.cardMe(personaName, red) : tx.ev.cardTeam(club, red);
    case 'injury':
      return tx.ev.injury(personaName, e.detail?.injuryWeeks ?? 1);
    case 'substitution':
      if (me) return e.detail?.personaIn ? tx.ev.subIn(personaName) : tx.ev.subOut(personaName);
      return tx.ev.subTeam(club);
  }
}
