import type { Club, Match, MatchEvent } from '@futbolchi/engine';

/** Human-readable Uzbek line for a match event. */
export function eventText(e: MatchEvent, m: Match, clubs: Record<string, Club>, personaName: string): string {
  const club = clubs[e.team === 'home' ? m.homeId : m.awayId].name;
  const me = e.actor === 'persona';
  const assist = e.detail?.assistByPersona ? ` ${personaName}ning pasidan.` : '';
  switch (e.type) {
    case 'goal':
      if (me) return `GOL! ${personaName} to'pni darvozaga yo'lladi!`;
      return `Gol! ${club} hisobni o'zgartirdi.${assist}`;
    case 'keyChance':
      if (me) return `${personaName} zarba berdi — ${e.detail?.saved ? 'darvozabon qaytardi' : "to'p yonidan o'tdi"}.`;
      return `${club} xavfli hujum qildi${e.detail?.saved ? ', darvozabon qaytardi' : ''}.${assist}`;
    case 'save':
      return `${personaName} ajoyib seyv qildi!`;
    case 'card': {
      const colour = e.detail?.card === 'red' ? 'qizil' : 'sariq';
      return me ? `${personaName} ${colour} kartochka oldi.` : `${club} o'yinchisi ${colour} kartochka oldi.`;
    }
    case 'injury':
      return `${personaName} jarohat oldi (${e.detail?.injuryWeeks ?? 1} hafta).`;
    case 'substitution':
      if (me) return e.detail?.personaIn ? `${personaName} maydonga tushdi!` : `${personaName} almashtirildi.`;
      return `${club}: almashtirish.`;
  }
}
