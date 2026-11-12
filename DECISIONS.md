# Decisions

Small choices made during the overnight build, so you can change them later.
All game numbers live in one file: `src/config/balance.ts`. Crew names and lines: `src/config/crew.ts`. Stamps: `src/config/stamps.ts`.

## Tech
- **PixiJS 8** draws the Moon base. It is a fast 2D drawing library that uses the phone's graphics chip, so it stays smooth on an iPhone.
- **Vite + TypeScript** builds the site. **Vitest** runs the logic tests (`npm test`).
- Buttons, panels and text are plain web page elements on top of the drawing. They are easier to read, tap and lay out on a phone.
- The game rules (`src/core`) have no drawing code in them. That keeps them testable and lets an iPhone app or a server reuse them later.
- The heading font (Righteous) is bundled with the site, so the game makes no outside requests at all.
- GitHub Pages is published by a GitHub Action on every push to `main`. The Action runs the tests first.

## Plugging in later
- **Astro Radar**: write a feed in `src/services/launches/` that follows the `LaunchFeed` shape, then change the one `feed` line in `src/services/launches/index.ts`. Each launch needs an id, a rocket name and a liftoff time. The same launch never counts twice.
- **Astro Social (Supabase)**: `src/services/social/index.ts` has the shape ready (`publish` your colony snapshot, list `friends`). It does nothing yet. No database was touched.
- **iPhone app**: browser-only bits sit in `src/platform` (storage and sharing). Swap those two files for native versions.

## Game design
- **One money**: Moon Credits. Plus **parts**, which only rockets bring, for upgrades. No real-money purchases.
- **Seeds are free.** Planting never costs anything, so a player can never get stuck.
- **First potatoes take 1 minute**, every later batch takes 30 minutes. The first rocket takes 45 seconds, later ones 20 minutes. So a brand-new player harvests and sees a rocket land in their first session.
- **Away earnings cap**: Solar Farms fill a battery that holds 12 hours of earnings. Twice-a-day visits fill it each time. Once full it just stops filling; nothing is taken away. Ripe crops, landed rockets and supply pods wait forever.
- **Crew mood is one number** (0 to 100). Each job uses a little: planting (Dot), building and upgrades (Gus), launches (Vera). It comes back on its own, faster with a better Habitat. Cheery (70+) = 15% faster. Sleepy (under 30) = 20% slower. Nothing worse ever happens.
- **Cheering up crew**: say hi once an hour (+6), share a snack from the pantry (+15), or serve a Galley meal (+30 to everyone).
- **Speed is set when a job starts.** A cheery botanist's crops stay fast even if she gets sleepy later. Simpler to understand.
- **Crops** go to the pantry. Sell them to Earth for credits, feed them to crew, or cook them in the Galley.
- **Rockets**: free to order, one at a time. Ordering launches right away and it always arrives. Liftoff is a bonus on top: time in the green band cuts up to 50% off the trip. If you close the game mid-Liftoff, the rocket still arrives on normal time.
- **Liftoff difficulty**: first 3 tries have a wide, slow-moving green band. After that it is narrower and drifts more. There is no fail state.
- **Real launch bonus**: double cargo applies if the rocket launched or lands while the 24-hour bonus is on. A free supply pod (100 credits, 5 parts) lands 25 seconds after the event.
- **Building**: tap Build, pick a module, tap a glowing tile. Buildings cannot be moved yet. Max: 1 Habitat, 3 Greenhouses, 4 Solar Farms, 1 Galley.
- **Upgrades** go to level 5 and take from 2 minutes to 2 hours (shorter with a cheery engineer). Greenhouse level 2 unlocks Starlight Pumpkins (12 hours).
- **Welcome back card** shows after 5+ minutes away. "Collect everything" collects solar, harvests ripe crops, unloads the rocket and pods.
- **Tapping things**: a ripe Greenhouse harvests, then opens its panel to replant. A Solar Farm with a coin bubble collects. The pad unloads rockets and pods. Crew open the crew panel.

## Look and sound
- Flat, slightly top-down travel poster style. Everything is drawn from shapes in code. Stamp icons in the Collection Book use the phone's own emoji.
- Sounds are short, soft tones made in code. On by default; the mute choice is remembered on that device. No background music (kept it calm and battery friendly).
- Reduced motion (from the phone or computer setting) turns off twinkling, walking, bobbing, bouncing arrows and the Earth rise.

## Test helpers
- Hidden test panel: tap Earth 5 times quickly, or add `?test` to the link. It can fire a real launch, skip time ahead, add credits, or start a new colony.
- Skipping time is saved in the browser so it survives a reload. "New colony" resets it.
