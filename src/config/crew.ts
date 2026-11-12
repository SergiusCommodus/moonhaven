/** The starting crew. Names and quirks are flavor; edit freely. */
export type Job = 'botanist' | 'engineer' | 'pilot';

export interface CrewProfile {
  id: string;
  name: string;
  job: Job;
  quirk: string;
  /** Things they say when you say hi. */
  lines: string[];
}

export const CREW: CrewProfile[] = [
  {
    id: 'dot',
    name: 'Dot Halloway',
    job: 'botanist',
    quirk: 'Hums swing tunes to the lettuce.',
    lines: [
      'The potatoes like Glenn Miller best.',
      'Did you know strawberries blush in low gravity? Neither did I.',
      'I named the big lettuce Gerald.',
    ],
  },
  {
    id: 'gus',
    name: 'Gus Marlowe',
    job: 'engineer',
    quirk: 'Gives every bolt a name.',
    lines: [
      'Say hello to Bolt Number Forty-Two. His name is Herbert.',
      'A wrench in time saves nine. Or so my pa said.',
      'This solar panel? Purring like a kitten.',
    ],
  },
  {
    id: 'vera',
    name: 'Vera Sparks',
    job: 'pilot',
    quirk: 'Waves at Earth every morning.',
    lines: [
      'Morning, Earth! Looking swell today.',
      'Fins, flames and a fresh pot of coffee. That is flying.',
      'One day I will race a comet. And win.',
    ],
  },
];

export const JOB_LABEL: Record<Job, string> = {
  botanist: 'Botanist',
  engineer: 'Engineer',
  pilot: 'Pilot',
};

export const JOB_HELPS: Record<Job, string> = {
  botanist: 'Crops grow faster when Dot is cheery.',
  engineer: 'Building and upgrades go faster when Gus is cheery.',
  pilot: 'Rockets fly faster when Vera is cheery.',
};
