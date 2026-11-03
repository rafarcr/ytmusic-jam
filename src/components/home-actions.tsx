"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function HomeActions() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function create() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/rooms", { method: "POST" });
      const data = (await response.json()) as { code?: string; hostToken?: string; error?: string };
      if (!response.ok || !data.code || !data.hostToken) {
        throw new Error(data.error || "Não consegui criar a jam.");
      }
      localStorage.setItem(`jam-host:${data.code}`, data.hostToken);
      router.push(`/jam/${data.code}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não consegui criar a jam.");
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <button
        type="button"
        onClick={() => void create()}
        disabled={pending}
        className="h-12 rounded-full bg-[#ff2d3a] px-6 text-base font-semibold text-white transition hover:bg-[#ff4450] disabled:opacity-60"
      >
        {pending ? "Criando..." : "Criar jam"}
      </button>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = code.trim().toUpperCase();
          if (/^[A-Z0-9]{5}$/.test(next)) router.push(`/j/${next}`);
        }}
      >
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Código"
          maxLength={5}
          aria-label="Código da jam"
          className="h-12 min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-4 tracking-[0.3em] uppercase outline-none placeholder:tracking-normal placeholder:text-white/40 focus:border-white/30"
        />
        <button
          type="submit"
          className="h-12 rounded-full border border-white/15 px-4 text-sm font-medium text-white/90"
        >
          Pedir
        </button>
      </form>
      {error ? <p className="text-sm text-[#ff8b93]">{error}</p> : null}
    </div>
  );
}
