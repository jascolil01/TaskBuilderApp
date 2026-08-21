# Questlog — Habit RPG

A mobile-first habit tracker with a dungeons-and-dragons vibe. Complete real-life
habits ("quests") to earn XP and level up six D&D-style character attributes
(Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma). Neglect a
habit past its grace period and its attribute starts losing XP — and eventually
levels — each day until you pick it back up.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4 for styling
- Zustand for state, persisted to `localStorage` (all data stays on-device)
- `vite-plugin-pwa` so it can be installed to your phone's home screen

## Running locally

```bash
npm install
npm run dev
```

Open the printed local URL on your phone (same network) or in a desktop
browser at mobile width. For a production build:

```bash
npm run build
npm run preview
```

## How the RPG mechanics work

- Each habit ("quest") is tagged to one attribute and has an XP reward, a
  schedule (daily or specific weekdays), and a grace period in days.
- Completing a quest awards its XP to that attribute and extends your streak.
- If a quest is missed on a scheduled day, the streak breaks immediately.
- If a quest stays missed for longer than its grace period, its attribute
  starts losing XP (and eventually levels) for every additional missed
  scheduled day, until the quest is completed again.
- Your overall character level is the average of your six attribute levels;
  your "class" (Warrior, Wizard, Rogue, etc.) is based on your highest attribute.
