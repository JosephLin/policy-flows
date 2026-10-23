# Policy Flows

Live demo: https://josephlin.github.io/policy-flows/ (unofficial prototype, served by
GitHub Pages from `main`).

A prototype of an info-view map for a city's policy platform, modeled on the
resource overlays in SimCity and Cities: Skylines. Each policy is a hex island, and
a resource bar picks one network (staff, data, know-how, care, access, space and
supply). The rest of the city goes gray while that resource's lanes animate between
the islands that send and receive it.

The island layout and the from→to flows were re-described from the public
structure of [puma.taipei/heart-island](https://puma.taipei/heart-island), which
shows the same flows as walkers in a 3D diorama. The six resource groups and all
the wording here are ours (see `data.js`).

There are two views over the same data and side panel (`ui.js`):

- `index.html` / `scene.js`: a 3D diorama in Three.js (pinned on jsDelivr via an
  import map). Islands, landmarks, roads and bridges are procedural. Lanes arc
  between islands, and people carrying resource-colored crates walk each lane's
  route over the bridges.
- `flat.html` / `flat.js`: the original flat SVG hex map, also the fallback when
  WebGL is unavailable.

There's no build step. Run `python3 serve.py`, then open http://localhost:5178. Any
static server works, but this one disables browser caching, so edits show on reload.

## Hosting

GitHub Pages serves the repo root of `main` as-is; `.nojekyll` stops Jekyll from
processing the files. A push to `main` redeploys the public site, so changes go
through a branch and PR from here on. `build_artifact.py` is only for the private
claude.ai artifact copy.
