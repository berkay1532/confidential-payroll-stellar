// Lightweight, privacy-friendly analytics wrapper around Plausible.
// No-ops unless NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set and the script has loaded.

type Props = Record<string, string | number | boolean>;

type PlausibleFn = (event: string, options?: { props?: Props }) => void;

export function track(event: string, props?: Props): void {
  if (typeof window === "undefined") return;
  const p = (window as unknown as { plausible?: PlausibleFn }).plausible;
  if (p) p(event, props ? { props } : undefined);
}
