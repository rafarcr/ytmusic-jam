"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { SearchHit, Song } from "@/lib/types";
import { useRoom } from "./use-room";

const NAME_EVENT = "jam-name-change";

function subscribeName(onStoreChange: () => void) {
  window.addEventListener(NAME_EVENT, onStoreChange);
  return () => window.removeEventListener(NAME_EVENT, onStoreChange);
}

function storedName() {
  return localStorage.getItem("jam-name") ?? "";
}

function saveName(value: string) {
  localStorage.setItem("jam-name", value.slice(0, 24));
  window.dispatchEvent(new Event(NAME_EVENT));
}

export function GuestJam({ code }: { code: string }) {
  const { room, status } = useRoom(code);
  const name = useSyncExternalStore(subscribeName, storedName, () => "");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<{
    query: string;
    results: SearchHit[];
    error: string | null;
  }>({ query: "", results: [], error: null });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;

    let ignore = false;
    const handle = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(text)}`)
        .then(async (response) => {
          const data = (await response.json()) as { results?: SearchHit[]; error?: string };
          if (ignore) return;
          setSearch({
            query: text,
            results: data.results ?? [],
            error: response.ok ? null : (data.error ?? "Não consegui buscar agora."),
          });
        })
        .catch(() => {
          if (!ignore) {
            setSearch({ query: text, results: [], error: "Não consegui buscar agora. Tenta de novo." });
          }
        });
    }, 350);

    return () => {
      ignore = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  const text = query.trim();
  const searching = text.length >= 2 && search.query !== text;
  const results = text.length >= 2 && search.query === text ? search.results : [];
  const searchError = text.length >= 2 && search.query === text ? search.error : null;

  const queued = new Set(
    (room ? room.queue.slice(room.cursor) : []).map((song) => song.videoId),
  );
  const current = room && room.cursor < room.queue.length ? room.queue[room.cursor] : null;
  const upcoming = room && current ? room.queue.slice(room.cursor + 1) : [];

  async function requestSong(hit: SearchHit) {
    setPendingId(hit.videoId);
    setMessage(null);
    try {
      const response = await fetch(`/api/rooms/${code}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...hit, requestedBy: name.trim() }),
      });
      const data = (await response.json()) as { error?: string };
      setMessage(response.ok ? `${hit.title} entrou na fila.` : (data.error ?? "Não entrou na fila."));
    } catch {
      setMessage("Não entrou na fila. Tenta de novo.");
    } finally {
      setPendingId(null);
    }
  }

  if (status === "missing" || status === "ended") {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-10">
        <p className="text-lg">Essa jam não existe ou já encerrou.</p>
        <Link href="/" className="mt-4 text-[#ff2d3a]">
          Voltar
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <p className="text-sm text-white/50">Pedir música</p>
      <h1 className="font-mono text-2xl tracking-[0.25em]">{code}</h1>

      <label className="mt-5 block text-sm text-white/60">
        Seu nome
        <input
          value={name}
          onChange={(event) => saveName(event.target.value)}
          placeholder="Como aparece na fila"
          maxLength={24}
          className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-base outline-none focus:border-white/30"
        />
      </label>

      <label className="mt-4 block text-sm text-white/60">
        Buscar
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Música ou artista"
          className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-base outline-none focus:border-white/30"
        />
      </label>

      {searching ? <p className="mt-3 text-sm text-white/45">Buscando...</p> : null}
      {searchError ? <p className="mt-3 text-sm text-[#ffb0b5]">{searchError}</p> : null}
      {message ? <p className="mt-3 text-sm text-white/80">{message}</p> : null}

      <ul className="mt-4 flex flex-col gap-2">
        {results.map((hit) => {
          const inQueue = queued.has(hit.videoId);
          return (
            <li
              key={hit.videoId}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2"
            >
              <Image
                src={`https://i.ytimg.com/vi/${hit.videoId}/hqdefault.jpg`}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{hit.title}</p>
                <p className="truncate text-sm text-white/55">
                  {[hit.artist, hit.album].filter(Boolean).join(" · ")}
                  {hit.duration ? ` · ${hit.duration}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={inQueue || pendingId === hit.videoId}
                onClick={() => void requestSong(hit)}
                className="h-10 shrink-0 rounded-full bg-[#ff2d3a] px-3 text-sm font-semibold disabled:bg-white/10 disabled:text-white/50"
              >
                {inQueue ? "Na fila" : pendingId === hit.videoId ? "..." : "Pedir"}
              </button>
            </li>
          );
        })}
      </ul>

      <section className="mt-8">
        <h2 className="text-sm tracking-wide text-white/45 uppercase">Fila</h2>
        {status === "loading" ? <p className="mt-2 text-white/50">Carregando...</p> : null}
        {!current && status === "ready" ? (
          <p className="mt-2 text-white/60">A fila está vazia. Pede a primeira.</p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2">
          {current ? <Line song={current} label="Agora" /> : null}
          {upcoming.map((song, index) => (
            <Line key={song.id} song={song} label={String(index + 1)} />
          ))}
        </div>
      </section>
    </main>
  );
}

function Line({ song, label }: { song: Song; label: string }) {
  return (
    <article className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2">
      <span className="w-10 text-xs text-white/40">{label}</span>
      <div className="min-w-0">
        <p className="truncate font-medium">{song.title}</p>
        <p className="truncate text-sm text-white/50">
          {[song.artist, song.requestedBy].filter(Boolean).join(" · ")}
        </p>
      </div>
    </article>
  );
}
