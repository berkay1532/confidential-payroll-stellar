"use client";
import { useState } from "react";
import { track } from "@/lib/analytics";

// Self-contained feedback widget. Posts to NEXT_PUBLIC_FEEDBACK_ENDPOINT (e.g. a Formspree /
// Tally webhook) when set; otherwise falls back to a mailto so it always works.
export function Feedback() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    track("feedback_submitted", { rating });
    const payload = { rating, text, at: new Date().toISOString(), app: "confidential-payroll" };
    const endpoint = process.env.NEXT_PUBLIC_FEEDBACK_ENDPOINT;
    try {
      if (endpoint) {
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const body = encodeURIComponent(`Rating: ${rating}/5\n\n${text}`);
        window.location.href = `mailto:gunduzberkay1532@gmail.com?subject=${encodeURIComponent(
          "Confidential Payroll feedback",
        )}&body=${body}`;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 shadow-lg hover:bg-white"
      >
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <div className="py-6 text-center">
                <div className="text-2xl">🙏</div>
                <p className="mt-2 text-sm text-neutral-300">Thanks for the feedback!</p>
                <button
                  onClick={() => {
                    setOpen(false);
                    setSent(false);
                    setRating(0);
                    setText("");
                  }}
                  className="mt-4 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="mb-3 text-sm font-medium text-neutral-100">How was the demo?</div>
                <div className="mb-4 flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setRating(n)}
                      className={`h-9 w-9 rounded-lg text-sm ${
                        n <= rating ? "bg-emerald-500 text-neutral-950" : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What worked, what was confusing, what you'd want next…"
                  rows={4}
                  className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-100 outline-none focus:border-neutral-600"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200">
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={busy || rating === 0}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
