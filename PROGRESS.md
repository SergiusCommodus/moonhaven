# Progress

## MORNING REPORT

**1. Live demo:** https://sergiuscommodus.github.io/moonhaven/
Code: https://github.com/SergiusCommodus/moonhaven

**2. What is done**
- All 8 milestones, plus all three extras (Galley, a 4th crop, Collection Book).
- A new player sees the base in under 1 second, plants in 2 taps, harvests after 1 minute, and lands a first rocket in 45 seconds.
- Logic is covered by 12 automated tests. The site rebuilds and republishes on every push.
- Played a whole new colony through, start to finish. No console errors.

**What is not done**
- Not tested on a real iPhone, only phone-sized windows in a desktop browser. Please do the 2-minute test below.
- I could not listen to the sounds; I only checked they play without errors.
- Reduced motion was checked in code, not with the system setting switched on.
- Astro Radar and Supabase are empty plug-in points by design (no database or secrets were touched).
- Buildings cannot be moved after placing. No background music.

**3. Two-minute phone test**
1. Open the live link in Safari on your iPhone.
2. Tap the glass greenhouse, then tap **Plant Potatoes**.
3. Tap **Build**, tap the **20¢** button by Solar Farm, then tap a glowing tile.
4. After about 1 minute a potato bubble appears. Tap the greenhouse to harvest.
5. Tap **Rocket**, then **Liftoff!**. Hold **HOLD** to keep the needle in the green.
6. About 45 seconds later the rocket lands. Tap it to unload.
7. Tap Earth 5 times quickly, then **Fire real launch**. Check the banner and the pod by the pad.
8. Tap **Postcard**, then **Save or share**.
9. Tap **Sound** to mute, reload the page, and check it stays muted.

**4. Top 3 things to build next**
1. Hook up Astro Radar so real launches fire the bonus by themselves (one file to write).
2. Friend visits with Astro Social: publish a small read-only colony snapshot and visit friends' bases.
3. Gentle daily goals ("Earth asks for 6 potatoes") plus Add to Home Screen, for a clear reason to come back twice a day.

---

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
- Postcard button: makes a vintage postcard of the colony (frames Earth and the base; tall card on phones, wide card on laptops) (cream card, stamp, crew names, date). Save or share it; on a phone you can also press and hold the picture.

## M7 Polish (done)
- Buildings drawn a bit larger; a soft squash-and-stretch when you tap one.
- Phone layout first: rows space out on tall screens, safe areas for the iPhone notch and home bar, no double-tap zoom, no long-press menus on the game.
- Checked at 375x667 (small iPhone), 390x844 (iPhone 14) and 1280x800 (laptop). On laptops panels float above the bottom bar.
- Frame rate capped at 60 (30 with reduced motion). Buildings only redraw when something changes. Drawing resolution capped at 2x.
- Reduced motion: no twinkling, no walking, no bobbing, no bouncing arrows, Earth does not rise, floating text just fades.

## M8 Check (done)
Played a brand-new colony start to finish on the production build at phone size:
plant → build Solar Farm → harvest → Liftoff / Auto Launch → unload → upgrade → crew chat and snack → pantry → 12 hours away → welcome back → Galley → Collection Book. No console errors.

Bugs found and fixed:
- Taps did not reach the base (an invisible layer was catching them).
- A closed panel peeked out at the bottom on laptops.
- Tapping the crate bubble above a landed rocket did nothing.
- The engine sound could throw an error when Liftoff ended.
- The Postcard could miss buildings if taken right after opening the game; it also cropped badly on phones.
- Tapping a Solar Farm collected 1 credit instead of opening its panel.
- Hint labels ran off the screen edge; hint arrows covered the harvest bubble.
- Added a fallback so Liftoff and Postcards draw on older iPhones (before iOS 16).

## Extras (done)
- Galley: cook Moon Fries, Crater Salad, Strawberry Shortcake, Starlight Pie. Serve to cheer up the whole crew, or sell.
- 4th crop: Starlight Pumpkins (12 hours), unlocked at Greenhouse level 2.
- Collection Book: 15 stamps to earn.
