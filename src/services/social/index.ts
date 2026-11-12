/**
 * Friend visits (Astro Social). Not built yet.
 *
 * Plan: a Supabase-backed `supabaseSocial` implements SocialService. It publishes a
 * small read-only snapshot of your colony (see `ColonySnapshot`) and fetches friends'
 * snapshots so you can visit their bases. The game only talks to `social` below.
 */
export interface ColonySnapshot {
  playerName: string;
  modules: { kind: string; col: number; row: number; level: number }[];
  crewMoods: number[];
  updatedAt: number;
}

export interface SocialService {
  available: boolean;
  publish(snapshot: ColonySnapshot): Promise<void>;
  friends(): Promise<{ id: string; name: string; snapshot: ColonySnapshot }[]>;
}

export const social: SocialService = {
  available: false,
  async publish() {},
  async friends() {
    return [];
  },
};
