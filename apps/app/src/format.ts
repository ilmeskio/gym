// Dates, durations and loads as the app shows them, in Italian.

export const longDay = (iso: string) =>
  new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

export const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00` : iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

export const time = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

export function duration(from: string, to: string) {
  const minutes = Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

export const EFFORT = ['Facile', 'Leggero', 'Giusto', 'Duro', 'Durissimo'];

/** "12 kg", "2,5 kg" or "corpo libero". */
export const kg = (n: number) => (n === 0 ? 'corpo libero' : `${String(n).replace('.', ',')} kg`);
