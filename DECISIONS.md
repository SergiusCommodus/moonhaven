# Decisions

Small choices made during the overnight build, so you can change them later.
All game numbers live in one file: `src/config/balance.ts`.

## Tech
- **PixiJS 8** draws the Moon base. It is a fast 2D drawing library that uses the phone's graphics chip, so it stays smooth on an iPhone.
- **Vite + TypeScript** builds the site. **Vitest** runs the logic tests.
- Buttons, panels and text are plain web page elements on top of the drawing. They are easier to read, tap and lay out on a phone.
- The game logic (`src/core`) has no drawing code in it. That keeps it testable and lets an iPhone app or a server reuse it later.
- The heading font (Righteous) is bundled with the site, so the game makes no outside requests.
- GitHub Pages is published by a GitHub Action on every push to `main`.
