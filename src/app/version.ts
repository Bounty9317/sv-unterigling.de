/**
 * Erkennt, ob seit dem Laden der Seite eine neue Version veröffentlicht wurde.
 * Ein länger offenes Browserfenster bekommt neue Daten automatisch, das Programm selbst aber erst nach dem Neuladen –
 * mit einem veralteten Programm darf z. B. keine Auto-Rotation laufen.
 */
import { useEffect, useState } from 'react';

/** Kennung des geladenen Programms (beim Build gesetzt, siehe astro.config.mjs) */
export const BUILD_ID: string = __BUILD_ID__;

/** Liegt online eine andere Version als die geladene? (Entwicklungsserver ohne version.json: nie) */
export async function newerVersionOnline(): Promise<boolean> {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return false;
    const { id } = (await response.json()) as { id?: unknown };
    return typeof id === 'string' && id !== BUILD_ID;
  } catch {
    return false;
  }
}

const CHECK_EVERY_MS = 5 * 60_000;

/** Prüft beim Start, alle 5 Minuten und wenn das Fenster wieder in den Vordergrund kommt. */
export function useNewerVersion(): boolean {
  const [newer, setNewer] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (await newerVersionOnline()) {
        if (!cancelled) setNewer(true);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    void check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return newer;
}
