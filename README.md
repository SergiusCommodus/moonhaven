# Moonhaven

A cozy retro 1950s Moon colony game for the web. Nothing dies, nobody fails.

Play: https://sergiuscommodus.github.io/moonhaven/

## Run it on your computer

```bash
npm install
npm run dev
```

## Folders

- `src/config` all tunable numbers (crop times, prices, caps)
- `src/core` game rules, with no drawing code (state, time, saving)
- `src/render` the PixiJS drawing of the base
- `src/ui` buttons, panels, hints and the Liftoff mini game
- `src/services/launches` real launch feed (test feed now, Astro Radar later)
- `src/services/social` friend visits (empty stub now, Supabase later)
- `src/platform` browser things like storage and sharing (swap for the iPhone app)
- `tests` logic tests
