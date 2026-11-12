/** Astro brand colors plus a warm 1950s poster palette. */
export const C = {
  night: 0x0b0a1f,
  purple: 0x7c5cff,
  gold: 0xd99a2b,
  teal: 0x1fb8a0,
  rose: 0xd2558e,
  cream: 0xfff4e0,
  orange: 0xf2a65a,
  peach: 0xffd3a5,
  chrome: 0xeae7f5,
  chromeMid: 0xbdb7d6,
  chromeDark: 0x7f78a0,
  glass: 0x9fe8dc,
  leaf: 0x5ccf7a,
  leafDark: 0x2f9a58,
  ground: 0x6b5a9e,
  groundDark: 0x2c2556,
  ocean: 0x2f74c9,
  land: 0x4fbf8f,
  ink: 0x1a1533,
} as const;

export const CROP_COLOR: Record<string, number> = {
  potato: 0xc9955a,
  lettuce: 0x6fd36b,
  strawberry: 0xe8475f,
  pumpkin: 0xf08a24,
};

export const JOB_COLOR: Record<string, number> = {
  botanist: C.teal,
  engineer: C.gold,
  pilot: C.rose,
};

export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
