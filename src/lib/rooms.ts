import { randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { PublicRoom, Room, Song } from "./types";

const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_QUEUE = 200;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DATA_PATH = path.join(process.cwd(), ".data", "rooms.json");

type Listener = (room: PublicRoom | null) => void;

type JamState = {
  rooms: Map<string, Room>;
  listeners: Map<string, Set<Listener>>;
  rates: Map<string, number[]>;
  loaded: boolean;
};

const globalState = globalThis as typeof globalThis & { __ytmusicJam?: JamState };

function state(): JamState {
  if (!globalState.__ytmusicJam) {
    globalState.__ytmusicJam = {
      rooms: new Map(),
      listeners: new Map(),
      rates: new Map(),
      loaded: false,
    };
  }
  const current = globalState.__ytmusicJam;
  if (!current.loaded) {
    current.rooms = loadRooms();
    current.loaded = true;
  }
  return current;
}

function loadRooms(): Map<string, Room> {
  try {
    const raw = readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as { rooms?: Room[] };
    const rooms = new Map<string, Room>();
    const now = Date.now();
    for (const room of parsed.rooms ?? []) {
      if (room.expiresAt > now) rooms.set(room.code, room);
    }
    return rooms;
  } catch {
    return new Map();
  }
}

function persist() {
  try {
    const rooms = [...state().rooms.values()];
    mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    writeFileSync(DATA_PATH, JSON.stringify({ rooms }, null, 2));
  } catch (error) {
    console.error("Não consegui salvar a jam em disco.", error);
  }
}

function emit(code: string) {
  const room = state().rooms.get(code) ?? null;
  const payload = room ? toPublic(room) : null;
  for (const listener of state().listeners.get(code) ?? []) listener(payload);
}

export function toPublic(room: Room): PublicRoom {
  return {
    code: room.code,
    expiresAt: room.expiresAt,
    cursor: room.cursor,
    queue: room.queue,
  };
}

export function subscribe(code: string, listener: Listener) {
  const listeners = state().listeners;
  const set = listeners.get(code) ?? new Set();
  set.add(listener);
  listeners.set(code, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(code);
  };
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

export function getRoom(code: string): Room | null {
  const room = state().rooms.get(normalizeCode(code));
  if (!room) return null;
  if (room.expiresAt <= Date.now()) {
    state().rooms.delete(room.code);
    persist();
    return null;
  }
  return room;
}

export function createRoom(): Room {
  const rooms = state().rooms;
  let code = "";
  do {
    code = [...randomBytes(5)]
      .map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
      .join("");
  } while (rooms.has(code));

  const now = Date.now();
  const room: Room = {
    code,
    hostToken: randomBytes(24).toString("hex"),
    createdAt: now,
    expiresAt: now + ROOM_TTL_MS,
    queue: [],
    cursor: 0,
  };
  rooms.set(code, room);
  persist();
  return room;
}

export function endRoom(code: string) {
  const room = getRoom(code);
  if (!room) return;
  state().rooms.delete(room.code);
  persist();
  emit(room.code);
}

export function hostAuthorized(room: Room, token: string | null) {
  if (!token) return false;
  const expected = Buffer.from(room.hostToken);
  const given = Buffer.from(token);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F]/g, "").trim().slice(0, max);
}

export type AddSongInput = {
  videoId?: unknown;
  title?: unknown;
  artist?: unknown;
  album?: unknown;
  duration?: unknown;
  requestedBy?: unknown;
};

export function addSong(
  code: string,
  input: AddSongInput,
  ip: string,
): { ok: true; room: PublicRoom; song: Song } | { ok: false; status: number; error: string } {
  const room = getRoom(code);
  if (!room) return { ok: false, status: 404, error: "Essa jam não existe ou já encerrou." };

  const videoId = cleanText(input.videoId, 11);
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return { ok: false, status: 400, error: "Música inválida." };
  }

  const upcoming = room.queue.slice(room.cursor);
  if (upcoming.some((song) => song.videoId === videoId)) {
    return { ok: false, status: 409, error: "Essa música já está na fila." };
  }
  if (room.queue.length >= MAX_QUEUE) {
    return { ok: false, status: 400, error: "A fila chegou no limite." };
  }

  const now = Date.now();
  const rateKey = `${room.code}:${ip}`;
  const recent = (state().rates.get(rateKey) ?? []).filter((stamp) => now - stamp < 2 * 60 * 1000);
  if (recent.length >= 8) {
    return { ok: false, status: 429, error: "Calma — espera um pouco para pedir outra." };
  }
  const last = recent.at(-1);
  if (last && now - last < 3000) {
    return { ok: false, status: 429, error: "Espera alguns segundos para pedir de novo." };
  }

  const song: Song = {
    id: randomUUID(),
    videoId,
    title: cleanText(input.title, 140) || "Sem título",
    artist: cleanText(input.artist, 140),
    album: cleanText(input.album, 140),
    duration: cleanText(input.duration, 16),
    requestedBy: cleanText(input.requestedBy, 24) || "Alguém",
    addedAt: now,
  };

  const wasIdle = room.cursor >= room.queue.length;
  room.queue.push(song);
  if (wasIdle) room.cursor = room.queue.length - 1;

  recent.push(now);
  state().rates.set(rateKey, recent);
  persist();
  emit(room.code);
  return { ok: true, room: toPublic(room), song };
}

export function advance(code: string, videoId: string): PublicRoom | null {
  const room = getRoom(code);
  if (!room) return null;
  const current = room.queue[room.cursor];
  if (current && current.videoId === videoId && room.cursor < room.queue.length) {
    room.cursor += 1;
    persist();
    emit(room.code);
  }
  return toPublic(room);
}

export function removeSong(code: string, songId: string): PublicRoom | null {
  const room = getRoom(code);
  if (!room) return null;
  const index = room.queue.findIndex((song) => song.id === songId);
  if (index < 0 || index < room.cursor) return toPublic(room);
  room.queue.splice(index, 1);
  persist();
  emit(room.code);
  return toPublic(room);
}
