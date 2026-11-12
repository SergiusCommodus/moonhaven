export interface LaunchEvent {
  /** Stable id, so the same launch never counts twice. */
  id: string;
  /** Rocket name shown in the banner, like "Falcon 9". */
  vehicle: string;
  /** Who flew it, like "SpaceX". Optional. */
  provider?: string;
  /** When it lifted off, in ms since 1970. */
  at: number;
  source: 'test' | 'astro-radar';
}

export interface LaunchFeed {
  /** Start listening. The callback runs once per new launch. Returns a stop function. */
  subscribe(onLaunch: (e: LaunchEvent) => void): () => void;
  /** Fetch recent launches (for catching up after being away). */
  recent(): Promise<LaunchEvent[]>;
}
