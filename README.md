# Policy Flows

A prototype of an info-view map for a city's policy platform, modeled on the
resource overlays in SimCity and Cities: Skylines. Each policy is a hex island, and
a resource bar picks one network (staff, data, know-how, care, access, space and
supply). The rest of the city goes gray while that resource's lanes animate between
the islands that send and receive it.

The island layout and the from→to flows were re-described from the public
structure of [puma.taipei/heart-island](https://puma.taipei/heart-island), which
shows the same flows as walkers in a 3D diorama. The six resource groups and all
the wording here are ours (see `data.js`).

Plain ES modules with an SVG map and no build step. Run it with any static
server, for example `python3 -m http.server 5178`, then open http://localhost:5178.
