import type { Club, Match, MatchEvent } from '@futbolchi/engine';
import { tx } from './index';

/** Human-readable line for a match event, in the current language (with player names when known). */
export function eventText(e: MatchEvent, m: Match, clubs: Record<string, Club>, personaName: string): string {
  const club = clubs[e.team === 'home' ? m.homeId : m.awayId].name;
  const me = e.actor === 'persona';
  const d = e.detail ?? {};
  const assistName = d.assistByPersona ? personaName : d.assist;
  const assist = assistName ? tx.ev.assistBy(assistName) : '';
  const red = d.card === 'red';
  switch (e.type) {
    case 'goal':
      if (me) return tx.ev.goalMe(personaName) + (d.assist ? tx.ev.assistBy(d.assist) : '');
      return (d.player ? tx.ev.goalBy(d.player, club) : tx.ev.goalTeam(club)) + assist;
    case 'keyChance':
      if (me) return tx.ev.shotMe(personaName, !!d.saved);
      return (d.player ? tx.ev.shotBy(d.player, !!d.saved, d.keeper) : tx.ev.chanceTeam(club, !!d.saved)) + assist;
    case 'save':
      return d.player ? tx.ev.saveBy(personaName, d.player) : tx.ev.save(personaName);
    case 'card':
      if (me) return tx.ev.cardMe(personaName, red);
      return d.player ? tx.ev.cardBy(d.player, club, red) : tx.ev.cardTeam(club, red);
    case 'injury':
      return me ? tx.ev.injury(personaName, d.injuryWeeks ?? 1) : tx.ev.injuryBy(d.player ?? club);
    case 'substitution':
      if (me) {
        if (d.personaIn) return tx.ev.subIn(personaName);
        return d.in ? tx.ev.subOutFor(personaName, d.in) : tx.ev.subOut(personaName);
      }
      return d.in && d.out ? tx.ev.subSwap(club, d.out, d.in) : tx.ev.subTeam(club);
  }
}
