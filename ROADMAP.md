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
36 of 94. The scene opens in daytime with half as many carriers. Adds the
before/after gallery and `tools/sbs.swift`.

### 2026-10-23 · 9. Landmark hover labels (PR #9)

Pointing at a landmark model shows the policy item it stands for (for example,
在宅醫療 on the 衛福 minibus), with a ring on the ground. Plain ground still shows
the island summary.

### 2026-10-23 · 10. Water and night (PR #10)

A brighter, blue moonlit night with stronger windows and lamps, and a soft halo
around each street lamp. The halos at first swallowed almost every hover and
click (Three.js hit-tests points within a whole unit, even hidden ones), which
left only 1 of the 36 labels reachable. They now opt out of hit-testing, and a
pointer sweep finds all 36.

### 2026-10-23 · 11. Shader water and medium-width bar (PRs #11, #12)

- The sea is shaded live instead of scrolling one tiled texture. Ripples come
  from nine overlapping waves, with turquoise shallows that deepen to blue away
  from each island's real outline, fresnel sky tint and lapping shore foam. It
  runs at half speed.
- The resource bar sizes itself to the map area with a container query, so at
  laptop widths (about 821–1,200 px) it wraps to two rows instead of spilling off
  and clipping the toggles.

## Next

1. **More landmarks**: further rounds toward the 94 items, as many as stay
   readable.
2. **Polish**: overlapping island labels in the north cluster, crowd density in
   全部, and performance on phones.
3. **Optional**: visitor analytics with a note in the 關於 section; versioned
   file URLs so a fresh deploy never loads half-updated (declined for now).
