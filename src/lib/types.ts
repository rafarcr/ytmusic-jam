export type Song = {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  requestedBy: string;
  addedAt: number;
};

export type Room = {
  code: string;
  hostToken: string;
  createdAt: number;
  expiresAt: number;
  queue: Song[];
  /** Index of the song that should be playing. Equal to queue.length when the jam is idle. */
  cursor: number;
};

export type PublicRoom = {
  code: string;
  expiresAt: number;
  cursor: number;
  queue: Song[];
};

export type SearchHit = {
  videoId: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
};
