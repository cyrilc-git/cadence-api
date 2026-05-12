import { brandDnaList } from './db';

export type DaySlot = { weekday: 0|1|2|3|4|5|6; label: string; pilier: string | null; active: boolean };

const DAY_LABELS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'] as const;
const DAY_REGEX: Array<[number, RegExp]> = [
  [1, /^lundi/i],[2, /^mardi/i],[3, /^mercredi/i],[4, /^jeudi/i],[5, /^vendredi/i],[6, /^samedi/i],[0, /^dimanche/i]
];

export async function getWeeklyPlan(): Promise<DaySlot[]> {
  const all = await brandDnaList().catch(() => []);
  const piliers = all.filter(x => x.kind === 'pilier');
  const slots: DaySlot[] = [1,2,3,4,5,6,0].map(wd => {
    const wkd = wd as DaySlot['weekday'];
    const match = piliers.find(p => {
      const r = DAY_REGEX.find(([d]) => d === wd)?.[1];
      return r ? r.test(p.label) : false;
    });
    const weekendDisabled = piliers.find(p => /pas de publication.*week-?end/i.test(p.label));
    const active = (wd >= 1 && wd <= 5) || (!weekendDisabled && (wd === 0 || wd === 6));
    return { weekday: wkd, label: DAY_LABELS[wd], pilier: match?.label || null, active };
  });
  return slots;
}

export function nextDateForPilier(pilier: string, from: Date = new Date()): { date: string; time: string } {
  let target = -1;
  for (const [d, r] of DAY_REGEX) { if (r.test(pilier)) { target = d; break; } }
  if (target < 0) target = (from.getDay() + 1) % 7;
  const next = new Date(from);
  next.setHours(7, 30, 0, 0);
  for (let i = 0; i < 14; i++) {
    if (next.getDay() === target && next.getTime() > Date.now()) break;
    next.setDate(next.getDate() + 1);
  }
  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: '07:30' };
}

export function nextWeekDates(from: Date = new Date()): Array<{ weekday: number; label: string; date: string }> {
  const out: Array<{ weekday: number; label: string; date: string }> = [];
  const d = new Date(from);
  const todayDow = d.getDay();
  let daysToMonday = (8 - todayDow) % 7;
  if (daysToMonday === 0) daysToMonday = 7;
  if (todayDow >= 1 && todayDow <= 4) daysToMonday = 1;
  d.setDate(d.getDate() + daysToMonday);
  for (let i = 0; i < 12; i++) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      out.push({ weekday: dow, label: DAY_LABELS[dow], date: `${yyyy}-${mm}-${dd}` });
    }
    d.setDate(d.getDate() + 1);
    if (out.length === 5) break;
  }
  return out;
}
