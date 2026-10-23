# Roadmap

Dated history of what shipped, then what's next. Before/after screenshots for
each milestone are in [`docs/milestones/`](docs/milestones/README.md).

## Shipped

### 2026-10-22 · 1. Flat prototype (`2643cfa`)

A flat SVG hex map of the 14 policy islands with a SimCity-style resource
selector. The source's 20 flows were regrouped from 15 story props into six
broad resources (staff, data, know-how, care, access, space and supply) so each
view has a network worth showing.

### 2026-10-22 · 2. 3D diorama (`d50736f`)

Three.js islands with a landmark per policy, arcing lanes, info-view graying and
click-to-focus. The flat map stays at `flat.html`, sharing `ui.js`.

### 2026-10-22 · 3. Traditional Chinese (`3f6cd11`)

All on-screen text in 台灣正體. Flow descriptions are our own wording, not the
source's copy.

### 2026-10-23 · 4. Walkers (`0c320c4`, `00dacd6`)

全部 shows every lane in its own color. People carrying resource-colored crates
walk each lane's shortest route over new ring roads and bridges.

### 2026-10-23 · 5. Public demo (PRs #1–#3, `ae0f46b`)

- An empty default view, toggling view buttons, and hover highlights for
  主要來源 and 流動.
- Independent 人物 and 箭頭 toggles, and a startup tour of resources 1–6.
- A two-row bar on phones.
- The 非官方 prototype badge, disclaimer and source attribution.
- Hosting on GitHub Pages from `main`. From here on, changes go through PRs.

### 2026-10-23 · 6. Visual pass (PR #4)

- `env.js`: Taipei-basin hills, a rippling sea with foam, clouds, sailboats and
  wind turbines.
- Beveled island tiles, and soft, chunky buildings, trees and lamps.
- Animated people with swinging limbs.
- A 夜晚 toggle with its own day and night palettes.

### 2026-10-23 · 7. People with roles (PR #5)

Carriers dress for their flow: office workers, researchers, travelers,
caregivers, a parent with a child, and farmers. Residents include children and
elders with canes.

### 2026-10-23 · 8. Policy landmarks, round 1 (PRs #6, #7)

2–3 of each island's policy items as small original models on the corner plots,
about 35 of 94. The scene opens in daytime with half as many carriers. Adds the
before/after gallery and `tools/sbs.swift`.

## Next

1. **Hover labels for landmarks**: pointing at a model shows its policy name.
2. **Water and night**: less rubbery water, and a brighter night with stronger
   lamps and windows.
3. **More landmarks**: further rounds toward the 94 items, as many as stay
   readable.
4. **Polish**: overlapping island labels in the north cluster, crowd density in
   全部, and performance on phones.
5. **Optional**: visitor analytics with a note in the 關於 section; versioned
   file URLs so a fresh deploy never loads half-updated (declined for now).
