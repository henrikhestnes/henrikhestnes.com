# Henrik Larsson Hestnes — Open Court

A personal homepage with three procedural sports illustrations and an original SVG winter print. Plain HTML, CSS and JavaScript; no build step.

## Preview

Hosted preview: https://henrik-larsson-hestnes.pages.dev. Cloudflare Pages serves the 12 public assets; backend source and tests are excluded. The shared guestbook is connected and accepting postcards; new notes await owner approval. See the backend README for verification details.

Open `index.html` in a browser, or serve the directory with a static HTTP server. The classic bootstrap imports pinned Three.js 0.180.0 from cdnjs. Internet is required for live 3D; the local poster, text, font and winter print remain available without it.

## Interaction

Choose a sport, then tap/click anywhere on its court. One short sequence plays in the existing composition, with a fixed camera and constant ball scale. Tap again to restart. The court is keyboard focusable: Enter or Space plays, Escape stops and returns to its starting pose. There are no bounce buttons, action labels, zooms, timelines or replay panels.

- **Futevôlei:** four players, a burgundy-and-white FT-5-inspired ball, a set and a shark attack.
- **Tennis:** two singles players, held rackets and a serve. Both feet stay behind the baseline through contact.
- **Football:** an attacking-third vignette with five figures: the crosser, Haaland, two defenders and goalkeeper. A left-wing cross becomes a rising header into the corner. Norway’s red shirts, white shorts and red socks contrast with Brazil’s yellow shirts, blue shorts and white socks. Flags and country names appear on a physical banner along the far touchline. The penalty spot sits on the goal centreline inside the box, at 11/16.5 of the penalty-area depth ([IFAB Law 1](https://theifab.com/laws/latest/the-field-of-play/)).

The football sequence is a stylized interpretation of Haaland's first goal against Brazil on 5 July 2026, composed for this miniature rather than reconstructed frame by frame. References: [FIFA goal clip](https://www.youtube.com/watch?v=dBNfnJ6DVOE), [TNT match commentary](https://www.tntsports.co.uk/football/world-cup/2026/live-brazil-norway_mtc1579508/live-commentary.shtml). The footvolley silhouette was informed by the [European Footvolley League elements description](https://efvl.squarespace.com/elements).

Ball radii remain the same at rest and in motion: 0.20 scene units for futevôlei, 0.18 for football and 0.075 for tennis, against roughly 2-unit figures. They are modestly enlarged for legibility, including at rest. The football cross travels predominantly sideways from near the left touchline. The supplied ball photograph informed the procedural panel pattern; no photo texture or commercial logo is embedded.

## Implementation and fallback

- `scene.js`: geometry, materials, figures, fixed camera, atomic sport selection and on-demand rendering.
- `shark-motion.js`: deterministic motion sampling, roster definitions and short sequence durations.
- `index.html` / `style.css`: content and responsive presentation. The full name appears in the hero, document title and metadata.
- `poster.jpg`: a 1200 × 840 still of the current futevôlei scene.
- `snow-print.svg`: original winter illustration with the burgundy-and-white ball.
- `fonts/`: Bricolage Grotesque and its license.

Sport selection commits the scene, caption, ball and controls together, without an asynchronous transition. The next tap always plays the selected sport. Rendering stops when no action needs frames; hidden/offscreen sequences stop. Device pixel ratio is capped at 2. Each sequence lasts less than five seconds.

Reduced motion makes a court tap show its contact pose without animation. Context loss and unavailable WebGL/CDN leave the poster visible and disable interactions. The court is the single accessible button; canvas and poster are decorative children. The closing horizontal rule sits farther below the hero artwork. A separate ink diagonal starts outside the slab and joins it for all three sports on desktop. Painted court boundaries stop at their corners; there are no sport captions below the artwork.

Use `?sport=tennis` or `?sport=football` to select an initial game.

## Export

Open `tools/artwork.html`, select a sport, then click **Download artwork**. It composites paper behind the scene and downloads a fixed 1200-pixel-wide JPEG at quality 0.82. Copy the default futevôlei download to `poster.jpg` after artwork changes. A normal static HTTP server is preferable for tools in browsers that restrict file access to parent directories.

## Validation

```sh
node --check henrikhestnes/scene.js
node --check henrikhestnes/shark-motion.js
node henrikhestnes/tests/shark-motion.test.js
```

The motion tests check roster sizes, finite/continuous positions, constant ball scale, floor and footvolley net clearance, server foot placement until contact, sole/racket/head contact and the header entering the goal mouth.

Pass 3 was reviewed in Safari and Chrome using file URLs. Confirmed action progression/completion, immediate sport selection followed by activation, keyboard activation, and zero requested animation frames during a ten-second idle observation. Chrome also reviewed 390px layouts and simulated reduced motion. The test instrumentation is temporary and is not part of the homepage.

Local HTTP listeners are unavailable in this environment. Actual phone touch/performance, production HTTP/CDN timing and real screen-reader output have not been measured. Set an absolute `og:image` URL when a production domain is chosen. The shared postcard guestbook uses its own Cloudflare Worker and D1 database; see `postcards-worker/README.md` for deployment status and owner setup. The homepage never stores guestbook entries in localStorage.

## Postcards

“Leave a postcard” sits below contact. Visitors provide a name, optional city and short note. Cards stay pending until Henrik approves them in the separate owner view. The form uses the shared endpoint in the `postcards-api` meta tag; a native form POST also works without JavaScript. The received-card list needs JavaScript. Unavailable service errors preserve input and offer retry.

Run `node --test henrikhestnes/tests/` from the workspace root for motion and Worker tests. Pass 4 was visually reviewed in Chrome at desktop and 390px widths. The regenerated poster is 1200 × 840 (64,842 bytes).

Pass 5 moves the match banner to the far touchline, corrects the penalty spot, removes the extended white baseline and captions, adds football’s diagonal and lowers the divider. Autotennis and CUDA matrix multiplication now explicitly state that they were built entirely without LLMs, as confirmed by Henrik.
