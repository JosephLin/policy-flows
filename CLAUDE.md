# Policy Flows

How to work on this repo. What it is and why: `README.md`. History and next
steps: `ROADMAP.md`. Before/after screenshots: `docs/milestones/`.

## Commands

- `python3 serve.py`: local server on http://localhost:5178 with
  `Cache-Control: no-store`. Plain `http.server` lets the browser keep stale ES
  modules, so a reload can mix versions. The repo's `.claude/launch.json` runs this.
- `swiftc -O tools/sbs.swift -o /tmp/sbs && /tmp/sbs before.png after.png out.png "Title"`:
  composes a milestone pair. Compile it; the Swift interpreter crashes on it.
- `python3 build_artifact.py`: copies the site into `data/work/artifact/` for the
  old private claude.ai artifact. Optional; the public demo is GitHub Pages.

No build step and no test suite. Verify by running the page and checking:
- the console is clean;
- in 3D, resource views 0–6, the 人物/箭頭/夜晚 toggles, a hover label on a
  landmark, and click-to-focus;
- the flat map at `flat.html`;
- at 375 px, 1,024 px and 1,440 px widths.

## Layout

- `data.js`: islands, outside connections, the six resource groups and 20 flows.
- `ui.js`: state, side panel, resource bar, tooltip, startup tour. Shared by both views.
- `scene.js`: the 3D city (islands, landmarks, roads, lanes, people, lighting,
  picking). `env.js`: sky, shader sea, hills, clouds, boats, turbines.
  `landmarks.js`: the policy item models and their names.
- `flat.js` / `flat.html`: the flat SVG map, also the no-WebGL fallback.

## Invariants

- GitHub Pages serves `main` as-is, so every push to `main` is a deploy. Work on
  a branch, open a PR, and rebase-merge.
- Scene colors (sky, sea, grass, rock) come from `PALETTE` in `scene.js` through
  `tone()`, not from CSS, so 夜晚 works in either page theme. Resource colors
  still come from CSS tokens.
- Each island's static meshes are merged by `bake()`. Anything that must stay
  separate (points, labels) must not be a Mesh, or it gets merged. Landmark
  hover therefore works from positions recorded when the items are placed.
- Lanes, bulbs and crates use `toneMapped: false` so resource colors stay exact.
- Item models and wording are original. Item names come from the source's public
  data, but no models, code or copy are taken from puma.taipei.

## Verified findings — don't "fix" these

- **Lamp halos opt out of raycasting** (`pts.raycast = () => {}`). Three.js
  hit-tests Points within 1 unit, even hidden ones. Without this, they were the
  first hit for 885 of 900 pointer positions, and only 1 of 36 labels was reachable.
- **Water is a shader, not a texture.** A scrolled tiled normal map read as a
  sliding rubber sheet even with 22 waves. The tuned values were measured on
  screen: ripple strength 2.6 (1.0 was invisible), fresnel 0.3 (0.55 washed the
  sea white), shallows fade over 1.0 unit (1.9 looked like fog), and
  `SEA_SPEED = 0.5`, chosen in review.
- **Dimmed lanes are 0.18 (arrows 0.33) with no bulbs.** 0.25 was too busy and
  0.12 too faint. 0.18 is the midpoint picked in review.
- **The bar wraps by container query** (`#stage`, max-width 880 px), not by
  window width. At a 1,024 px window, the map is 684 px and the one-row bar is
  843 px.
- **No cloud shadows.** Shadow-only clouds read as dark stains on the water.
- **Boat loop and turbine islet are sized to clear each other.** Measured: hulls
  stay at least 0.24 from the islet and 0.51 from any island foam.
- **Pages caches files for 10 minutes** (`max-age=600`), so a viewer can briefly
  get a mix of old and new files after a deploy. Versioned URLs were declined;
  a hard refresh fixes it.
