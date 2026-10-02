"use client";

import { useState } from "react";

/**
 * Approve / reject controls for the human review queue. Sends the admin key as
 * a header (never in the URL) to the headers-only review API.
 */
export function ReviewActions({
  articleId,
  adminKey,
}: {
  articleId: string;
  adminKey: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ articleId, action }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
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
    <div className="mt-4 pt-4 border-t border-ink-line">
      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => act("approve")}
          className="px-4 py-2 bg-signal text-ink font-semibold rounded hover:opacity-90 disabled:opacity-50"
        >
          اعتمد وانشر
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act("reject")}
          className="px-4 py-2 border border-ink-line text-paper-dim rounded hover:text-warn hover:border-warn disabled:opacity-50"
        >
          ارفض
        </button>
      </div>
      {error && (
        <p className="text-warn text-xs mt-3" dir="ltr">
          {error}
        </p>
      )}
    </div>
  );
}
