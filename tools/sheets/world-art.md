# Illustrations des quatre univers

Ces dessins ont été réalisés avec ImageGen intégré. Les panoramas et les matériaux proviennent de planches opaques. Les objets et la main du yéti ont été dessinés sur fond transparent. Les PNG livrés sont recadrés et indexés pour le jeu. Le rendu utilise directement ces fichiers.

Les quatre dossiers d’objets sont [desert](../../sprites/roadside/desert), [alpine](../../sprites/roadside/alpine), [city](../../sprites/roadside/city) et [foundry](../../sprites/roadside/foundry). Les [panoramas](../../sprites/background) et les [textures de piste](../../sprites/track) portent les mêmes identifiants. Les panneaux de texte et leur traduction sont déclarés dans `js/sprites.js` et `js/locales/`.

## Horizons

```text
Use case: stylized-concept.
One production panorama atlas for Midnight Monsters, a hand-pixeled 1990s 16-bit arcade racer.
Landscape 1536x1024, EXACTLY FOUR panoramic strips of EQUAL height stacked vertically edge to edge, no margins, dividers, labels, lettering, roads, vehicles, UI or foreground props.
Each strip is a complete ultrawide distant horizon, silhouette meets flat terrain at 88% of ITS OWN strip height.
Broad readable shapes, dark plum inks, crisp limited SNES palettes, parallax game backgrounds, no blur or smooth 3D.
TOP strip: Egypt cursed roadside resort at night, starry midnight-blue sky, immense golden dunes, hotel pyramids lit with turquoise fire, seated colossi and a crescent moon.
SECOND strip: much brighter alpine ski country, teal aurora rippling over midnight-blue and periwinkle snowy peaks, layered ridges, black fir forests and tiny orange illuminated chalets.
THIRD strip: rainy midnight monster metropolis, layered black and plum skyscrapers, tall silhouette of a Godzilla-like original commuter monster walking among them, magenta nightlife signage and acid green reflections.
BOTTOM strip: wide infernal industrial night shift, black iron foundry towers, cranes, chains and smoking chimneys against a dark vermilion sky, yellow embers and blazing orange rivers of lava.
Each landscape a different unmistakable palette.
Crisp retro pixel clusters visible on a handheld display.
```

## Chaussées et terrains

```text
Use case: stylized-concept.
A single SQUARE 4 by 4 production MATERIAL TEXTURE atlas, sixteen exactly equal squares touching edge to edge, absolutely orthographic from directly above, bold low-resolution hand-painted 16-bit pixel art for a gritty arcade monster racing game.
Tileable with no lighting gradients, no perspective, text, symbols, lettering, borders, hard dividing lines or objects casting tall shadows.
In every row column ONE is a full-width drivable road tile with ragged thin shoulders along the two vertical edges and just two broken parallel lane separators at 1/3 and 2/3 running straight VERTICALLY; column TWO is natural off-road terrain seamless on all sides; column THREE is a special drivable road variant, vertical travel from bottom to top, fill the whole tile, restrained contrast; column FOUR is a second road variant.
Top row Egyptian desert: dark muted sandstone-tiled tourist highway / golden dune ripples / interior blue-black temple limestone causeway edged with turquoise light / desert highway with windblown ochre sand encroaching on both edges.
Second row haunted ski resort: blue-gray snow-packed winding-road material / dappled pale blue untouched snow / a giant shaggy ivory yeti palm used as a bridge with fur tufts and purple creases / icy blue road with dark tunnel floor and short amber lamps at edges.
Third row monster city: dark purple rain-wet asphalt, worn yellow broken lines / wet cobbled sidewalk with hot pink and green reflections / a zebra crossing of white painted bars transverse to traffic on wet asphalt / wet asphalt with faint acid-green reflections.
Fourth row hell foundry: dark plum-black riveted iron plates with muted yellow lane dashes / black volcanic slag with small glowing lava channels / black rubber assembly conveyor with transverse rollers and yellow-black caution-striped edges / dark industrial iron with orange heat stains.
Assets must have clear high-level material separation, like retro video game tiles viewed straight down.
```

## Objets du désert

```text
Use case: stylized-concept.
One square transparent production sprite sheet, EXACTLY 3 columns by 3 rows of separate, equally spaced drawings in invisible equal cells, no labels, no visible grid.
Each object fits completely inside its own cell, ample empty margins. 16-bit Midnight Monsters arcade racer, grounded roadside scenery from slightly above bumper level, strong dark plum outlines, bold pixel clusters, ochre gold stone, turquoise flame, navy shadows.
Row 1: (1) an imposing FRONT-FACING seated golden sphinx, raised body spanning a LARGE TRANSPARENT DRIVABLE ARCH between its paws, both pillars at the far sides and empty central bottom from feet to chest; (2) a partly buried 1930s Egyptian gas station with a gas pump; (3) pyramidal kitsch hotel with ornate lit windows and a turquoise neon crescent.
Row 2: (1) enormous worn seated pharaoh statue; (2) a freestanding roadside tourist billboard on two posts with a colorful pictogram of a reclining mummy on holiday and a small blank caption panel; (3) a bandaged mummy thumbing a ride beside her broken-down ancient tow cart.
Row 3: (1) large shiny turquoise scarab beetle scarlet eyes viewed from behind at a slight angle with six visible legs; (2) a gilded fallen sarcophagus lying crosswise at a slight tilt on the ground; (3) tall sandstone torch pedestal burning with a turquoise flame.
All true transparent alpha including arch opening, NO checkered background, no scene backdrop, no floor slabs except intrinsic bases, no text or shadows outside objects.
```

## Objets de la station alpine

```text
Use case: stylized-concept.
One square transparent pixel-art production sprite atlas, EXACTLY 3x3 equal cells, single fully separate object in each invisible square with generous pixel margins.
Dark plum outlines with crisp large SNES game pixel clusters, bright pale blue snow, fir black, chalet amber and aurora mint.
View from just above road bumper for 16-bit monster racing game.
Top row cells left to right: (1) FRONT elevation of a wide mountain tunnel entrance built into a snowy rocky arch, amber lights and a LARGE OPEN TRANSPARENT doorway from the ground to near its top for vehicles; (2) black snow-draped alpine spruce; (3) crooked ski chalet, steep orange-lit roof windows with skis leaning on the wall.
Middle row: (1) road warning sign with tire-chain pictogram and comical pale-blue ghost literally entangled with iron chains underneath; (2) BIG disembodied yeti hand, seen at low angle from wrist tip, palm upward horizontal like a bridge deck, chunky blue-white fur and curled fingers at its left and right edges, dark icy wrist opening at bottom; (3) looming rolling avalanche front, broad rounded billow of icy snow erupting over a jagged ridge with a bold edge and internal blue shadow.
Bottom row: (1) possessed orange snowplow three-quarter rear facing away with visible hefty blade and eerie green eyes or lamps; (2) spectral ice-blue skier crossing sideways on parallel skis with poles, vivid silhouette; (3) low FLAT irregular patch of shiny blue black ice viewed from slightly above, foreshortened in a wide shallow ellipse with white skate scratches.
Genuine transparent background including tunnel opening, no shadow blobs, guides, lettering or checkerboard.
```

## Objets de Monstropolis

```text
Use case: stylized-concept.
Single square transparent production sprite atlas for Midnight Monsters 16-bit arcade racer, EXACTLY 3 by 3 fully separate objects in nine invisible equal square cells with breathing room.
Hand-drawn chunky pixel clusters, dark ink outlines, rain-slick plum, hot pink and acid green/gold neon, view slightly above bumper height.
Top row: (1) a HUGE goofy midnight-blue reptilian commuting monster walking, holding a briefcase, looking at a traffic signal.
FRONT VIEW with feet near the two far edges and a VERY WIDE EMPTY TRANSPARENT gap between legs which cars drive through; (2) roadside neon restaurant façade with striped awning, crescent moon sign and vampire waiter; (3) short row of monster office workers in dark suits (vampire, wolf and zombie) under a tiny magenta-lit bus shelter.
Middle row: (1) a traffic signal on a single tall black pole, RED lamp brightly on, below unlit amber/green lenses; (2) comic ghost-yellow taxi with glowing rooftop lamp seen from the REAR at a slight angle, mint ghost driver; (3) orange striped roadworks barricade with one blinking lamp, no words.
Bottom row: (1) a dark round urban manhole cover in pavement with an upright vivid pale green/white plume of steam; (2) vertical neon magenta and mint diner sign on a post depicting a bat dining with a fork, no lettering; (3) cast iron street lamp with fuchsia bulb and city banner.
Genuine alpha in gaps, incl between the giant's legs from shoe to crotch; no painted background/floor, lettering, outside shadows or grid.
```

## Objets de la fonderie

```text
Use case: stylized-concept.
One square TRANSPARENT production sprite atlas exactly 3x3 separate equal cells, fully contained subjects with generous empty space in every cell.
Arcade horror comedy racing, crisp hand-pixeled SNES objects, no gradients or anti-aliased painting, coal black plum iron with molten orange, ember yellow, crimson.
Camera slightly above bumper level.
Top row: (1) front view of a wide industrial hydraulic press gantry, vertical columns at the OUTER sides, high crossbar and a raised rectangular stamp, very large genuinely TRANSPARENT passage beneath for race cars; (2) freestanding chunky suspended hydraulic stamping hammer hanging DOWN from a short shaft, rectangular hazard-striped heavy die with red-hot lower edge, front view, no supporting frame; (3) foundry furnace with visible orange lava mouth, smokestack and chain.
Middle row: (1) demons in work overalls on a picket line holding one broad BLANK cream banner, space for a later localized text; (2) squat runaway ore wagon on wheels full of orange molten iron seen in rear three-quarter view; (3) ruptured black iron valve pipe with a white-hot steam plume.
Bottom row: (1) FORESHORTENED broad puddle of molten orange metal with yellow glowing core and irregular dark edges lying flat on the road; (2) tall iron lattice post with hooked chain and red warning lamp; (3) conveyor line of dark wooden coffins and hanging chains, compact roadside silhouette.
Nine isolated finished pieces, fully transparent background and arch opening, no lettering, no visible grid, no separate floor or cast shadows.
```

## Intérieurs et ravin

```text
Use case: stylized-concept.
Production atmosphere atlas, four full-bleed ultrawide panoramic strips stacked edge-to-edge at EXACT EQUAL heights in one 1536x1024 landscape, no dividers, no numbers, no HUD, no road, no cars.
Hand pixel art of 1990s 16-bit pseudo-3D monster racer with clear bold pixel clusters and few colors, strong silhouettes, eye level horizon at bottom of each strip.
Strip 1: INSIDE a vast ancient sphinx, horizontally repeating Egyptian dark indigo sandstone chamber with carved pharaoh profiles, huge square columns and pairs of brilliant turquoise flames, stone ceiling overlaps entire top.
Strip 2: sweeping golden sandstorm on open dunes, ochre sand veils, dusty amber sky and barely-visible colossal pharaoh silhouettes near bottom.
Strip 3: deep alpine ravine far below, distant snow-clad cliffs and black pines against a pale mint aurora, blue drop beneath a yeti bridge, NO hand or bridge in the artwork itself.
Strip 4: INSIDE a haunted alpine mountain tunnel, repeating blue-black rocky buttresses, amber industrial wall lights, massive overhead beams, snowy stone ceiling across entire top.
No perspective portal, no central corridors receding in perspective, each ultrawide image is a horizontal side-scrolling surrounding environment.
No words.
```

## Main du yéti

```text
Use case: stylized-concept.
One finished SQUARE true-transparent 16-bit arcade racing game terrain texture.
Perfectly TOP DOWN orthographic view of the PALM SIDE of ONE enormous yeti hand stretched flat to carry cars across a chasm, its four adjacent FINGERTIPS at the TOP edge and broad hairy WRIST at the BOTTOM edge.
The giant open hand is the ENTIRE bridge and fills at least 95 percent of the canvas both vertically and horizontally.
Thick stubby fingers pressed tightly together so the centre route is continuous; four distinct rounded fingertips and short creases, one clear side thumb curling to the left.
Broad pale ice-blue and ivory PALM (bare lavender-gray skin with big graphic curved palm lines), dark blue fur on the sides and wrist only.
Tiny gritty snow flecks; thick deep plum pixel clusters on the outer contour.
Dramatic chunky pixel art, crisp 1990s SNES aesthetic.
Transparent EMPTY space around the silhouette, very narrow margins, no cliffs, trees, ground, backdrop, roads, words, vehicle, markings, extra paws or other objects.
The forward-moving car goes from wrist at bottom to fingers at top.
Make it instantly recognizable as a giant five-digit palm.
```
