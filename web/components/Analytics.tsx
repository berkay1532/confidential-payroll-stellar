"use client";
import Script from "next/script";

// Loads Plausible only when a domain is configured (NEXT_PUBLIC_PLAUSIBLE_DOMAIN),
// so dev/preview builds don't ship a dangling analytics script.
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
