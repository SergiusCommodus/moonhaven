# Progress

## M1 Setup
- Project created (Vite, TypeScript, PixiJS).
- Repo: https://github.com/SergiusCommodus/moonhaven
- Live: https://sergiuscommodus.github.io/moonhaven/

## M2 The base (done)
- Night sky with twinkling stars, a sunrise glow, Earth rising over the hills, Moon ground with craters.
- 5 x 5 grid with a rocket landing pad. Habitat and Greenhouse are there from the start.
- Build panel: place a Solar Farm, extra Greenhouses, or a Galley on a glowing tile.
- Every module can be upgraded to level 5. Upgrades take time and show a progress bar.

## M3 Crew and crops (done)
- Dot (botanist), Gus (engineer), Vera (pilot), each with a quirk, lines and a mood.
- Cheery crew work 15% faster, sleepy crew 20% slower. Mood comes back on its own in the Habitat.
- Crops: Space Potatoes 30 min (the very first ones take 1 minute), Lettuce 2 h, Strawberries 8 h.
- Solar Farms earn credits while you are away, up to 12 hours' worth. Ripe crops never spoil.
- Saves to the browser after every action (with a backup copy). Welcome back card after 5+ minutes away.
- 12 logic tests pass (`npm test`).

## M4 Rockets (done)
- Order a free rocket. It always arrives on its own (first one in 45 seconds, then 20 minutes).
- Liftoff mini game: hold to throttle, keep the needle in the green. Up to 50% faster trip. Wide easy band for the first 3 tries.
- Auto Launch button in the rocket panel and inside the mini game.
- Rocket flies across the sky, lands on the pad, tap it to unload credits and parts.

## M5 Real launch event (done)
- All launch news goes through one module: `src/services/launches/index.ts`. Today it uses a test feed; an Astro Radar feed plugs in by changing one line.
- When a launch fires: banner "Falcon 9 just lifted off. Supply drop on the way.", double cargo for 24 hours (badge in the top bar shows hours left), and a free supply pod parachutes down by the pad.
- Hidden test button: tap Earth 5 times quickly, or open the link with `?test` at the end. The test panel can also skip time ahead.

## M6 Feel (done)
- First time hints: one bouncing gold arrow with 2 to 4 words. Plant, build a Solar Farm, harvest, order a rocket, unload. Then they stop.
- Soft sounds made in code (plant, harvest, coins, build, launch, landing, chime, stamp, engine hum). Mute switch is remembered.
- Postcard button: makes a vintage postcard of the colony (cream card, stamp, crew names, date). Save or share it; on a phone you can also press and hold the picture.
