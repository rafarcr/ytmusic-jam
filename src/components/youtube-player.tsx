"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type YTPlayer = {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  stopVideo: () => void;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          width?: string;
          height?: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: () => void;
          };
        },
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type PlayerHandle = {
  play: () => void;
};

const ENDED = 0;

function loadYoutubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    if (!document.querySelector('script[data-youtube-iframe="true"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.dataset.youtubeIframe = "true";
      document.head.appendChild(script);
    }
  });
}

export const YoutubePlayer = forwardRef<
  PlayerHandle,
  {
    videoId: string | null;
    onEnded: (videoId: string) => void;
    onError: (videoId: string) => void;
    onPlaying: () => void;
  }
>(function YoutubePlayer({ videoId, onEnded, onError, onPlaying }, ref) {
  const frameRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const videoRef = useRef(videoId);
  const loadedRef = useRef<string | null>(null);
  const stoppingRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const onPlayingRef = useRef(onPlaying);
  videoRef.current = videoId;
  onEndedRef.current = onEnded;
  onErrorRef.current = onError;
  onPlayingRef.current = onPlaying;

  useImperativeHandle(ref, () => ({
    play() {
      const current = videoRef.current;
      const player = playerRef.current;
      if (!player || !current) return;
      if (loadedRef.current !== current) {
        loadedRef.current = current;
        stoppingRef.current = false;
        player.loadVideoById(current);
      }
      player.playVideo();
    },
  }));

  useEffect(() => {
    let cancelled = false;
    const element = frameRef.current;
    if (!element) return;

    void loadYoutubeApi().then(() => {
      if (cancelled || !window.YT || !frameRef.current) return;
      const mount = document.createElement("div");
      mount.className = "h-full w-full";
      frameRef.current.replaceChildren(mount);
      playerRef.current = new window.YT.Player(mount, {
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            playerRef.current = event.target;
            const current = videoRef.current;
            if (!current) return;
            loadedRef.current = current;
            stoppingRef.current = false;
            event.target.loadVideoById(current);
          },
          onStateChange: (event) => {
            if (event.data === 1) onPlayingRef.current();
            if (event.data === ENDED && !stoppingRef.current && loadedRef.current) {
              onEndedRef.current(loadedRef.current);
            }
          },
          onError: () => {
            if (loadedRef.current) onErrorRef.current(loadedRef.current);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      element.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (!videoId) {
      if (loadedRef.current) {
        stoppingRef.current = true;
        loadedRef.current = null;
        player.stopVideo();
      }
      return;
    }
    if (loadedRef.current === videoId) return;
    loadedRef.current = videoId;
    stoppingRef.current = false;
    player.loadVideoById(videoId);
  }, [videoId]);

  return <div ref={frameRef} className="h-full w-full" />;
});
