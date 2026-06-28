// V58.3 — Fuseau horaire Europe/Paris, centralisé.
//
// Cyril saisit et lit des heures de PARIS ; le stockage (content_items.scheduled_at,
// published_at) est en instant UTC (ISO). Avant, scheduledIso construisait
// `new Date("YYYY-MM-DDTHH:MM:00")` interprété dans le fuseau du PROCESS (UTC sur
// Vercel) et la relecture mélangeait getUTCHours (qui « marchait » par hasard sur
// un serveur UTC) et toLocaleString(timeZone:'Europe/Paris') — d'où des heures
// affichées incohérentes (07:30 ici, 09:30 là) et un mauvais jour de calendrier
// pour les posts de très tôt le matin. On convertit désormais explicitement, dans
// les deux sens, via Intl (sans dépendance, OK navigateur + Node).

const TZ = 'Europe/Paris';

// Offset de Europe/Paris vs UTC (minutes) à l'instant `date` — gère l'heure d'été.
function parisOffsetMinutes(date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const hour = p.hour === '24' ? '00' : p.hour; // certaines impls rendent 24 à minuit
  const asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +hour, +p.minute, +p.second);
  return Math.round((asIfUtc - date.getTime()) / 60000);
}

// Heure murale Paris (jour 'YYYY-MM-DD' + 'HH:MM') -> instant UTC (ISO).
// Robuste sauf dans la fenêtre d'1h de transition d'heure d'été (jamais utilisée
// pour une programmation éditoriale type 07:30).
export function parisWallClockToUtcIso(d10: string, hhmm: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d10) || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [Y, M, D] = d10.split('-').map(Number);
  const [h, m] = hhmm.split(':').map(Number);
  const naiveUtc = Date.UTC(Y, M - 1, D, h, m, 0);
  if (isNaN(naiveUtc)) return null;
  const off = parisOffsetMinutes(new Date(naiveUtc));
  return new Date(naiveUtc - off * 60000).toISOString();
}

// Instant ISO -> 'HH:MM' affiché en heure de Paris.
export function parisHHMM(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  // en-GB garantit le format 'HH:MM' (deux-points), reparsable par scheduledIso.
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
}

// Instant ISO -> 'YYYY-MM-DD' = jour calendaire à Paris ('en-CA' rend déjà ISO).
export function parisDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}
