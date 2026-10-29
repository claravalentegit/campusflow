# Study Room

Study with friends in a cozy room. Everyone has a pixel-art character; pick Study, Rest or Break and a timer
(25/5, 50/10, 15/3 or custom). Study alone, or make a room and share its code (like `MAPLE-42`) so friends
appear live as their own characters. No chat: friends can only send emoji cheers.

```bash
npm install
npm run dev          # app on http://localhost:5173
npm run dev:server   # rooms server on :8788 (Vite proxies /api to it)
npm test             # timer, validation and room logic
npm run build && npm start   # production, http://localhost:8788
```

## How it works

- `shared/model.ts`: timer rules (Study rolls into Rest, Rest/Break into Ready), validation, room codes.
- `server/`: Node built-ins only. Rooms live in memory (nothing is written to disk); live updates use
  Server-Sent Events. Each browser has a secret key; only its hash is stored, and others see a short
  public id, so nobody can change someone else. People who close the tab disappear after about a minute;
  empty rooms close after 30 minutes. Max 12 people per room. Names are limited to 16 letters/numbers.
- `src/`: no framework. Characters are drawn from text grids in `sprites.ts`; the room in `scene.ts`
  follows the real time of day. Your character, name and total study time (which unlocks hats) are saved
  in this browser.

Hosting: `render.yaml` at the repository root creates it as a second Render service (`rootDir: studyroom`).
