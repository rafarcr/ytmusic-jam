"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Song } from "@/lib/types";
import { useRoom } from "./use-room";
import { YoutubePlayer, type PlayerHandle } from "./youtube-player";

function emptySubscribe() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

function guestOrigin(address: string | null) {
  const port = window.location.port;
  const here = window.location.hostname;
  const onLocalhost = here === "localhost" || here === "127.0.0.1";
  if (onLocalhost && address) return `http://${address}${port ? `:${port}` : ""}`;
  return window.location.origin;
}

export function HostJam({ code }: { code: string }) {
  const { room, status } = useRoom(code);
  const playerRef = useRef<PlayerHandle>(null);
  const isClient = useIsClient();
  const token = useSyncExternalStore(
    emptySubscribe,
    () => localStorage.getItem(`jam-host:${code}`),
    () => null,
  );
  const role = !isClient ? "pending" : token ? "host" : "viewer";
  const [addresses, setAddresses] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [guestUrl, setGuestUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const advancing = useRef(false);

  useEffect(() => {
    let ignore = false;
    void fetch("/api/network")
      .then((response) => response.json())
      .then((data: { addresses?: string[] }) => {
        if (ignore) return;
        const next = data.addresses ?? [];
        setAddresses(next);
        const address = next[0] ?? null;
        setPicked(address);
        setGuestUrl(`${guestOrigin(address)}/j/${code}`);
      })
      .catch(() => {
        if (!ignore) setGuestUrl(`${guestOrigin(null)}/j/${code}`);
      });
    return () => {
      ignore = true;
    };
  }, [code]);

  const current = room && room.cursor < room.queue.length ? room.queue[room.cursor] : null;
  const played = room ? room.queue.slice(0, room.cursor) : [];
  const upcoming = room ? room.queue.slice(current ? room.cursor + 1 : room.cursor) : [];

  const endsAt = room
    ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(room.expiresAt)
    : "";

  async function advance(videoId: string) {
    if (!token || advancing.current) return;
    advancing.current = true;
    try {
      await fetch(`/api/rooms/${code}/next`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId }),
      });
    } finally {
      advancing.current = false;
    }
  }

  async function remove(song: Song) {
    if (!token) return;
    await fetch(`/api/rooms/${code}/songs/${song.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function endJam() {
    if (!token) return;
    if (!window.confirm("Encerrar a jam? O QR para de funcionar.")) return;
    await fetch(`/api/rooms/${code}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function copyLink() {
    await navigator.clipboard.writeText(guestUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (status === "missing") {
    return (
      <Shell>
        <p className="text-lg">Essa jam não existe ou já encerrou.</p>
        <Link href="/" className="mt-4 inline-block text-[#ff2d3a]">
          Criar outra
        </Link>
      </Shell>
    );
  }

  if (status === "ended") {
    return (
      <Shell>
        <p className="text-lg">Jam encerrada.</p>
        <Link href="/" className="mt-4 inline-block text-[#ff2d3a]">
          Voltar
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-white/50">Jam</p>
          <h1 className="font-mono text-3xl tracking-[0.25em]">{code}</h1>
        </div>
        <p className="text-sm text-white/50">{endsAt ? `Até ${endsAt}` : "Jam de 12 horas"}</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex flex-col gap-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
            {role === "host" ? (
              <YoutubePlayer
                ref={playerRef}
                videoId={current?.videoId ?? null}
                onEnded={(videoId) => void advance(videoId)}
                onError={(videoId) => {
                  setNotice("Essa faixa não toca aqui. Pulando.");
                  void advance(videoId);
                }}
                onPlaying={() => {
                  setStarted(true);
                  setNotice(null);
                }}
              />
            ) : role === "pending" ? null : (
              <div className="flex h-full items-center justify-center px-6 text-center text-white/70">
                Abre a jam no navegador em que ela foi criada para o som sair.
              </div>
            )}
          </div>

          {role === "host" && current && !started ? (
            <button
              type="button"
              onClick={() => playerRef.current?.play()}
              className="h-12 rounded-full bg-[#ff2d3a] text-base font-semibold"
            >
              Tocar
            </button>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs tracking-wide text-white/45 uppercase">Tocando agora</p>
            {current ? (
              <>
                <h2 className="mt-1 text-xl font-semibold">{current.title}</h2>
                <p className="text-white/65">{credit(current)}</p>
                <p className="mt-1 text-sm text-white/45">Pedido de {current.requestedBy}</p>
              </>
            ) : (
              <p className="mt-1 text-white/70">Ninguém pediu ainda. Mostra o QR.</p>
            )}
            {notice ? <p className="mt-2 text-sm text-[#ffb0b5]">{notice}</p> : null}
            {role === "host" ? (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={!current}
                  onClick={() => current && void advance(current.videoId)}
                  className="h-10 rounded-full border border-white/15 px-4 text-sm disabled:opacity-40"
                >
                  Pular
                </button>
                <button
                  type="button"
                  onClick={() => void endJam()}
                  className="h-10 rounded-full px-4 text-sm text-white/60"
                >
                  Encerrar
                </button>
              </div>
            ) : null}
          </div>

          <QueueList
            played={played}
            upcoming={upcoming}
            canRemove={role === "host"}
            onRemove={(song) => void remove(song)}
          />
        </section>

        <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-lg font-semibold">Pedir no celular</h2>
          <p className="mt-1 text-sm leading-6 text-white/60">
            O celular precisa estar no mesmo Wi-Fi. Deixa esta aba aberta enquanto a festa rola.
          </p>
          {addresses.length > 1 ? (
            <label className="mt-3 block text-sm text-white/60">
              Endereço do QR
              <select
                value={picked ?? ""}
                onChange={(event) => {
                  const address = event.target.value;
                  setPicked(address);
                  setGuestUrl(`${guestOrigin(address)}/j/${code}`);
                }}
                className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black px-3"
              >
                {addresses.map((address) => (
                  <option key={address} value={address}>
                    {address}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {guestUrl ? (
            <Image
              src={`/api/qr?text=${encodeURIComponent(guestUrl)}`}
              alt="QR code para pedir música"
              width={224}
              height={224}
              unoptimized
              className="mx-auto mt-4 h-56 w-56 rounded-xl bg-white p-2"
            />
          ) : null}
          <p className="mt-3 break-all font-mono text-xs text-white/55">{guestUrl}</p>
          {guestUrl.includes("localhost") || guestUrl.includes("127.0.0.1") ? (
            <p className="mt-2 text-sm text-[#ffb0b5]">
              Esse link só abre neste computador. Acha o IP da rede nas configurações do Wi-Fi e
              abre a jam por ele para o QR funcionar no celular.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void copyLink()}
            className="mt-3 h-10 w-full rounded-full border border-white/15 text-sm"
          >
            {copied ? "Link copiado" : "Copiar link"}
          </button>
        </aside>
      </div>
    </Shell>
  );
}

function QueueList({
  played,
  upcoming,
  canRemove,
  onRemove,
}: {
  played: Song[];
  upcoming: Song[];
  canRemove: boolean;
  onRemove: (song: Song) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {upcoming.length > 0 ? <p className="text-xs tracking-wide text-white/45 uppercase">A seguir</p> : null}
      {upcoming.map((song, index) => (
        <QueueRow
          key={song.id}
          song={song}
          label={String(index + 1)}
          canRemove={canRemove}
          onRemove={onRemove}
        />
      ))}
      {played.length > 0 ? (
        <details className="mt-2 text-sm text-white/45">
          <summary className="cursor-pointer">Já tocou ({played.length})</summary>
          <div className="mt-2 flex flex-col gap-2">
            {played.map((song) => (
              <QueueRow key={song.id} song={song} label="" canRemove={false} onRemove={onRemove} dim />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function QueueRow({
  song,
  label,
  canRemove,
  onRemove,
  dim = false,
}: {
  song: Song;
  label: string;
  canRemove: boolean;
  onRemove: (song: Song) => void;
  dim?: boolean;
}) {
  return (
    <article
      className={`flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2 ${dim ? "opacity-50" : "bg-white/[0.03]"}`}
    >
      <span className="w-10 shrink-0 text-xs text-white/40">{label}</span>
      <Image
        src={`https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`}
        alt=""
        width={48}
        height={48}
        className="h-12 w-12 rounded-md object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{song.title}</p>
        <p className="truncate text-sm text-white/55">
          {credit(song)}
          {song.requestedBy ? ` · ${song.requestedBy}` : ""}
        </p>
      </div>
      {canRemove ? (
        <button
          type="button"
          onClick={() => onRemove(song)}
          className="text-sm text-white/50"
          aria-label={`Tirar ${song.title} da fila`}
        >
          Tirar
        </button>
      ) : null}
    </article>
  );
}

function credit(song: { artist: string; album: string }) {
  return [song.artist, song.album].filter(Boolean).join(" · ");
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/" className="text-sm font-medium tracking-[0.2em] text-[#ff2d3a] uppercase">
        Jam
      </Link>
      <div className="mt-4">{children}</div>
    </main>
  );
}
