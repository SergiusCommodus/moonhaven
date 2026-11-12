/**
 * Every tunable number in Moonhaven lives here.
 * Times are in seconds unless the name says otherwise.
 * Change a number, save, and the game uses it on the next load.
 */

const MIN = 60;
const HOUR = 60 * MIN;

export const BALANCE = {
  start: {
    credits: 60,
    parts: 0,
  },

  /** Away earnings from Solar Farms stop growing after this many hours. Nothing already earned is lost. */
  idle: {
    capHours: 12,
    /** Show the "Welcome back" card if you were away at least this long. */
    welcomeBackAfterSeconds: 5 * MIN,
  },

  grid: {
    cols: 5,
    rows: 5,
    /** Tile reserved for the rocket landing pad. */
    pad: { col: 4, row: 0 },
  },

  crops: {
    potato: {
      name: 'Space Potatoes',
      short: 'Potatoes',
      growSeconds: 30 * MIN,
      /** The very first potatoes ever planted grow this fast, so the first harvest happens in session one. */
      firstGrowSeconds: 60,
      sellPrice: 8,
      unlockGreenhouseLevel: 1,
    },
    lettuce: {
      name: 'Grow Light Lettuce',
      short: 'Lettuce',
      growSeconds: 2 * HOUR,
      sellPrice: 28,
      unlockGreenhouseLevel: 1,
    },
    strawberry: {
      name: 'Moon Strawberries',
      short: 'Strawberries',
      growSeconds: 8 * HOUR,
      sellPrice: 90,
      unlockGreenhouseLevel: 1,
    },
    pumpkin: {
      name: 'Starlight Pumpkins',
      short: 'Pumpkins',
      growSeconds: 12 * HOUR,
      sellPrice: 140,
      unlockGreenhouseLevel: 2,
    },
  },

  modules: {
    habitat: {
      name: 'Habitat',
      maxCount: 1,
      /** Cost of the 1st, 2nd, 3rd... building of this kind. */
      buildCost: [{ credits: 0, parts: 0 }],
      buildSeconds: [5],
      /** Crew mood recovered per hour, by Habitat level (index 0 = level 1). */
      moodPerHour: [10, 14, 18, 23, 30],
    },
    greenhouse: {
      name: 'Greenhouse',
      maxCount: 3,
      buildCost: [
        { credits: 0, parts: 0 },
        { credits: 250, parts: 5 },
        { credits: 600, parts: 12 },
      ],
      buildSeconds: [5, 2 * MIN, 10 * MIN],
      /** Growing spots by Greenhouse level. */
      plots: [2, 3, 4, 5, 6],
    },
    solar: {
      name: 'Solar Farm',
      maxCount: 4,
      buildCost: [
        { credits: 20, parts: 0 },
        { credits: 150, parts: 2 },
        { credits: 400, parts: 8 },
        { credits: 900, parts: 15 },
      ],
      buildSeconds: [10, 2 * MIN, 10 * MIN, 30 * MIN],
      /** Moon Credits earned per hour by one Solar Farm, by level. */
      creditsPerHour: [30, 45, 65, 90, 120],
    },
    galley: {
      name: 'Galley',
      maxCount: 1,
      buildCost: [{ credits: 300, parts: 6 }],
      buildSeconds: [3 * MIN],
    },
  },

  /** Upgrading any module to the next level. Index 0 = going from level 1 to 2. */
  upgrades: {
    maxLevel: 5,
    cost: [
      { credits: 80, parts: 3, seconds: 2 * MIN },
      { credits: 220, parts: 6, seconds: 10 * MIN },
      { credits: 480, parts: 10, seconds: 30 * MIN },
      { credits: 950, parts: 16, seconds: 2 * HOUR },
    ],
  },

  crew: {
    startMood: 85,
    /** Mood at or above this = Cheery. Below `sleepy` = Sleepy. */
    cheery: 70,
    sleepy: 30,
    /** Job time multipliers. Lower is faster. */
    speed: { cheery: 0.85, steady: 1, sleepy: 1.2 },
    /** Mood each job uses up. Mood comes back on its own over time. */
    moodCost: { plant: 3, build: 12, upgrade: 12, launch: 10, cook: 4 },
    sayHi: { mood: 6, cooldownSeconds: 1 * HOUR },
    snackMood: 15,
    mealMood: 30,
  },

  rocket: {
    travelSeconds: 20 * MIN,
    /** The very first rocket is quick, so a new player sees one land. */
    firstTravelSeconds: 45,
    cargo: { credits: 50, parts: 4 },
    liftoff: {
      /** A perfect Liftoff cuts the trip by this share (0.5 = half the time). */
      maxSpeedup: 0.5,
      durationSeconds: 8,
      /** Green band height as a share of the gauge. Wide for the first tries, then narrower. */
      bandEasy: 0.46,
      bandNormal: 0.26,
      easyTries: 3,
      /** How fast the throttle rises while held and falls when released (share of gauge per second). */
      throttleUp: 0.55,
      throttleDown: 0.45,
      /** How far and how fast the green band drifts. */
      driftEasy: 0.08,
      driftNormal: 0.22,
    },
  },

  realLaunch: {
    boostHours: 24,
    cargoMultiplier: 2,
    /** A free supply pod lands soon after a real launch. */
    supplyDrop: { credits: 100, parts: 5, arriveSeconds: 25 },
  },

  galley: {
    recipes: {
      fries: {
        name: 'Moon Fries',
        needs: { potato: 3 },
        cookSeconds: 10 * MIN,
        sellPrice: 40,
      },
      salad: {
        name: 'Crater Salad',
        needs: { lettuce: 2, potato: 1 },
        cookSeconds: 30 * MIN,
        sellPrice: 95,
      },
      shortcake: {
        name: 'Strawberry Shortcake',
        needs: { strawberry: 2, potato: 2 },
        cookSeconds: 1 * HOUR,
        sellPrice: 260,
      },
      pie: {
        name: 'Starlight Pie',
        needs: { pumpkin: 1, strawberry: 1 },
        cookSeconds: 2 * HOUR,
        sellPrice: 320,
      },
    },
  },
} as const;

export type CropId = keyof typeof BALANCE.crops;
export type ModuleKind = keyof typeof BALANCE.modules;
export type RecipeId = keyof typeof BALANCE.galley.recipes;

export const CROP_IDS = Object.keys(BALANCE.crops) as CropId[];
export const MODULE_KINDS = Object.keys(BALANCE.modules) as ModuleKind[];
export const RECIPE_IDS = Object.keys(BALANCE.galley.recipes) as RecipeId[];
