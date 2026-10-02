"use client";

import { useState } from "react";

/**
 * Approve / reject controls for the human review queue. Authentication rides on
 * the HttpOnly admin session cookie the login form set, so the key is never
 * held in the page, in a query string, or in an outbound header.
 */
export function ReviewActions({ articleId }: { articleId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ articleId, action }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: { errors?: string[] };
      };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      window.location.reload();
    } catch {
      setError("تعذّر تنفيذ الطلب");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 pt-4 border-t border-ink-line">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => act("approve")}
          className="px-4 py-2 bg-signal text-ink text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          اعتمد وانشر
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act("reject")}
          className="px-4 py-2 border border-ink-line text-sm text-paper-dim hover:text-warn hover:border-warn disabled:opacity-50 transition-colors"
        >
          ارفض
        </button>
      </div>
      {error && (
        <p className="mt-3 text-warn text-xs" dir="ltr">
          {error}
        </p>
      )}
    </div>
  );
}