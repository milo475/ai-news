"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      setMsg({ ok: data.ok, text: data.message });
      if (data.ok) setEmail("");
    } catch {
      setMsg({ ok: false, text: "Сүлжээний алдаа. Дахин оролдоно уу." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-line p-5 space-y-3">
      <div className="space-y-1">
        <h2 className="font-semibold">Долоо хоногт нэг имэйл — AI-ийн тойм монголоор.</h2>
        <p className="text-sm text-muted">Хамгийн чухал мэдээ, жагсаалтын өөрчлөлт нэг захиад.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tany@mail.mn"
          aria-label="Имэйл хаяг"
          className="flex-1 min-w-48 rounded border border-line bg-transparent px-3 py-2 text-sm"
        />
        <button
          disabled={busy}
          className="rounded border border-accent/50 text-accent px-4 py-2 text-sm hover:bg-accent/10 disabled:opacity-50"
        >
          {busy ? "Илгээж байна…" : "Бүртгүүлэх"}
        </button>
      </form>

      {msg && <p className={`text-sm ${msg.ok ? "text-up" : "text-down"}`}>{msg.text}</p>}
      <p className="text-xs text-muted">Спам илгээхгүй. Хүссэн үедээ нэг товшилтоор гарна.</p>
    </section>
  );
}
