# Illustrations des quatre univers et de l’arrivée

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

## Vie des bas-côtés

Chaque univers a une planche de six scènes et deux petits motifs au sol. Les planches ImageGen ont été découpées aux gouttières transparentes. Le jeu charge les 32 PNG individuels dans les dossiers [désert](../../sprites/roadside/desert), [station de ski](../../sprites/roadside/alpine), [ville](../../sprites/roadside/city) et [fonderie](../../sprites/roadside/foundry).

<details>
<summary>Consignes ImageGen des planches de bord de route</summary>

Pour chacune des quatre planches, utiliser le texte commun suivi du paragraphe du biome.

```text
Use case: stylized-concept. A production atlas of six roadside sprite drawings for Midnight Monsters, the spooky humorous 16-bit arcade racer. Landscape 3:2 canvas made of exactly THREE COLUMNS by TWO ROWS of equally sized invisible square cells. The six subjects in the listed reading order stay completely inside their own cells and stand firmly on the bottom of their own drawing. Keep generous fully transparent gutters all the way between cells, with at least 9% clear margin inside every cell. Only the objects/characters, props grouped into one coherent silhouette per cell, no scenery, floor plane, ambient haze, drop shadow, lettering, UI, frames, grid or background. Genuine transparent alpha everywhere outside the silhouettes and inside openings. Retro hand-pixeled outlined sprites, clusters as if drawing each individual piece at 100–150 pixels tall, dark aubergine ink outlines, deliberate jagged steps, 3-4 shade ramps, strong highlights, no blur or smooth painting. Use the same low three-quarter roadside camera for all six, slightly above bumper level, frontal enough that faces and objects read while driving. A warm horror-comedy cast acting out their jobs at the side of the road. Strongly different silhouettes and colors between cells.
```

**Désert des mirages**

```text
Haunted Egyptian tourist highway under a midnight sky: golden sandstone, ochre wraps, turquoise faience, dark lapis blue, coral awnings. TOP LEFT a leaning date palm, broad layered green fronds, ochre dates and a tiny tied water jug at the foot; TOP MIDDLE a one-humped camel resting on folded legs, patterned red saddle, turquoise straps and two overstuffed holiday suitcases, camel head high; TOP RIGHT a squat little striped coral-and-cream awning over an oasis juice cart with a grinning crocodile vendor pouring from a copper urn into a cup. BOTTOM LEFT a broken tapering lapis-and-gold sandstone obelisk, its cracked top piece leaning against the base, incised sun and eye pictograms; BOTTOM MIDDLE a small seated blue-black Anubis jackal porter in gold collar balancing a suitcase and an ivory feather on an antique brass luggage scale, readable wide silhouette; BOTTOM RIGHT a hunched purple vulture perched on a stack of turquoise and terracotta canopic jars with animal-head lids, wings slightly out. Each cell is its own independent finished roadside sprite.
```

**Station de ski**

```text
Condemned haunted ski station. Moonlit pale blues, indigo pine shadows, warm tangerine parkas, mint spirit light, berry-red skis. TOP LEFT a grounded squat steel ski-lift pylon: one short overhanging support arm and a single hanging red chair carrying two laughing skeletons in wool hats, all connected to the central mast, no cable extending outside the cell; TOP MIDDLE a shaggy ice-blue yeti in an orange work apron leaning over a grounded wooden waxing bench and polishing a single red ski; TOP RIGHT a stout Saint Bernard mountain rescue dog standing upright on all four paws, dark tan patches on ivory fur, glowing ghost-blue ears, classic little brandy barrel collar and red rescue scarf. BOTTOM LEFT a turquoise and orange fan snow cannon on two squat wheels, angled upward, icicles on its rim, no plume extending out of the machine; BOTTOM MIDDLE three ski school monster children in bright red, mint and golden snowsuits standing with striped upright skis and one snowboard, waving at the racers as a close little group; BOTTOM RIGHT an unusually tall crooked rack of colorful upright skis with a purple scarf and a pair of boots tucked below, frost on the supporting timber beam. Each cell standalone.
```

**Monstropolis**

```text
Monstropolis at midnight, wet violet ink, electric pink, acid mint and amber neon, chunky readable urban silhouettes with color accents physically attached to objects. TOP LEFT a covered city bus shelter with a low curved teal glass roof, small orange circular stop pictogram and a pair of tired bat commuters huddled underneath, no readable letters; TOP MIDDLE a small pink wheeled street-food cart with a steamed noodle bowl topper and a happy three-eyed octopus cook tossing noodles, tight steam attached only; TOP RIGHT a tall art-deco magenta public phone booth, long mint-glowing ghost arm coiled around the handset, base visible. BOTTOM LEFT a hulking hinged-lid green dumpster mimic with two amber eyes, its bin lid raised and a tiny purple alley cat looking down from the lid, squat wide silhouette on casters; BOTTOM MIDDLE a skeleton cycle courier in teal jacket and purple helmet balancing one foot on the ground beside a stationary banana-yellow cargo bicycle loaded with parcel boxes; BOTTOM RIGHT an undead purple-skinned street saxophonist in crimson porkpie hat and teal coat, blowing a big brass sax next to an open instrument case with a few coins, planted feet, no floating music notes. No text even on the booths.
```

**Fonderie**

```text
Night shift at the infernal metalworks. Blue-black forged iron, soot violet, orange molten metal, mustard paint, sharp yellow highlights and occasional turquoise welding light. TOP LEFT a tilting steel foundry ladle on a sturdy riveted stand pouring a short attached ribbon of glowing orange metal into its ingot mould at the foot; TOP MIDDLE a fat battered ochre industrial air compressor on short iron feet with a huge exposed teal-spoked flywheel, broad red dial on top, distinct round silhouette; TOP RIGHT a helmeted skeleton welder with bent elbows leaning over a grounded steel workbench, short visible mint welding spark at the joint, bright readable work pose. BOTTOM LEFT two small tired horned imps in oil-stained overalls on their lunch break seated on a wooden crate sharing a bright turquoise thermos, one dangling boot; BOTTOM MIDDLE a tall rack of freshly cast iron ingots on two shelves with a few still glowing cherry-red, big crooked lifting tongs hanging at one end, scuffed yellow-black stripe on base; BOTTOM RIGHT a lumpy coal golem with warm gold eyes and tangerine gloves, bent under a hefty brown sack of coke over one shoulder, chipped coal pieces by its heavy feet. Each is distinct from a blast furnace, rail cart or traffic obstacle.
```

**Petits décors au sol des quatre univers**

```text
Use case: stylized-concept. ONE production atlas for Midnight Monsters, a colorful 16-bit pixel art horror-comedy racer. Eight low roadside set-dressing sprites, precisely TWO COLUMNS by FOUR ROWS, each invisible cell square on a 1:2 portrait transparent canvas. Paint each subject in the cell specified below, all eight completely isolated with generous clear margins and continuous empty horizontal and vertical gutters. Wide, LOW, chunky silhouettes grounded along the base, view from slightly above a car bumper. Use crisp pixels as if each drawing were 95 pixels wide, dark plum outlines and simple selective highlights, short three-step color ramps. Pieces in a sprite should form ONE cluster or touch each other. No letters, numbers, UI, extra vehicles, floating glows, ground planes, panels, guides or background. Real transparent alpha around each silhouette, including gaps. Row 1 is the Gobi-gold cursed Egyptian desert: left, a low windswept olive-green thorn shrub with three bold magenta flowers, a little gecko on an ochre root; right, a horizontal tumble of two broken sandstone relief blocks, one large lapis blue carved eye, a tiny dark scorpion on its edge, chipped ochre stones at foot. Row 2 is the icy ski station: left, two rounded blue-grey boulders capped with white snow, a tiny black fir sapling and short mint icicles tight against the boulders; right, a pair of red and saffron straw safety bales with two short sloping orange ski boundary poles on the SAME bale, short turquoise ski pennant, snow along the feet, no gate or open arch. Row 3 is a neon monster city: left, two squat side-by-side turquoise and magenta newspaper vending boxes with stylized bold blank paper pictograms and a coin slot, full outline to the ground; right, a stubby dark-plum and scarlet fire hydrant with brass caps, two expressive lavender alley rats sharing a discarded french fry at the base. Row 4 is the infernal night-shift foundry: left, one low heavy coil of chunky warm steel chain piled around a bright mustard crane shackle on a pair of dark slag bricks; right, two slightly tilted battered indigo and rusty orange oil drums together with a grinning little soot sprite peeking out of the open top. Nothing is airborne. All eight clusters are different, readable at a glance when small in a racing game. Exactly columns=2 and rows=4.
```

</details>

## Aire d’arrivée

La caméra superpose le panorama de la dernière zone, son sol `floor_<zone>.png`, le damier, les bolides et la tribune transparente `crowd.png`. La tribune mesure 640 × 480 et entoure les huit sols. Les rectangles de `FINISH_CHEERS` et `FINISH_FLAGS` dans `js/render.js` suivent les rangées et les fanions du dessin. Les huit sols en perspective proviennent d’une planche illustrée de deux colonnes sur quatre lignes, dans l’ordre motel, marais, carnaval, cimetière, désert, station de ski, ville et fonderie. Les véhicules utilisent leurs vues du garage. [Dessins de l’arrivée](../../sprites/track/finish)

### Arène

```text
Use case: stylized-concept.
A finished in-game background painting for the finish corral of Midnight Monsters, a 1990s pixel-art arcade monster racer. Landscape 4:3 screen, a raised camera behind the arriving racers looks forward and down into a huge horseshoe-shaped finish enclosure like a World Cup ski finish stadium at dusk. Make the U unmistakable: a continuous dense grandstand curves from the close lower left edge, around the far end at center, and back towards the close lower right edge. Three rows of distinct CHEERING whimsical horror fans: vampires, waving skeletons, bandaged mummies, pumpkin heads, werewolves, witches, Frankenstein monsters, hopping jiangshi, kappa, ghosts and yetis; striped scarves, tiny purple pennants, a few chequered flags, hands up. Beautiful expressive faces in the first rows, dark plum outlines and crowd silhouettes behind. Purple-and-gold crash barriers follow the horseshoe. Cool purple dusk, magenta stadium floodlights, warm amber lamps, four flagpoles and a little purple bunting. Far stands and sky occupy the upper 36% of the screen; at either outer edge the arms of the crowd curve down to roughly 68% screen height. In the middle 80% of the width below the stands leave a large open FLAT charcoal-violet paved apron with only subtle cobbled texture and tyre wear, wide enough to superimpose 8 live vehicles in two rows. The opening is at the foreground bottom center. Discreet black and ivory chequered finish stripe extremely low along foreground entrance. Draw NO vehicles, no racers, no podium, no text or lettering, no numbers, no HUD, no logos. Full-bleed 4:3 artwork. Crisp hand-pixeled 16-bit game screen with broad, tightly clustered pixels, strong silhouettes, limited violet/amber/teal palette; neither smooth 3D nor an illustrated poster. Joyful, ghoulish crowd ringing a dark clear parking apron.
```

### Spectateurs des barrières

```text
Use case: stylized-concept.
Production transparent sprite atlas for the spectator barriers of Midnight Monsters, a crisp 16-bit horror-comedy arcade racer. A square image containing THREE separate very wide HORIZONTAL STRIPS stacked vertically in three equal rows. Each strip is ONE isolated, dense, complete crowd section facing the viewer, teeth and faces visible, behind a waist-high violet-and-gold rally barrier with a small band of black-and-ivory racing chequers. Each strip has roughly 12 different lively monsters shoulder to shoulder, some arms raised, with one small pennant or flag. First strip friendly vampires, skeletons, green Frankensteins, witches and a ghost; second strip pumpkin-head fans, skeletons, bandaged mummies and cheering werewolves; third strip folk monsters: horned oni, jiangshi with yellow hats, kappa, blue yeti and tiny goblins. Silhouettes are varied; hand-painted chunky arcade pixels, thick dark plum outlines and crisp amber, magenta, mint highlights readable at tiny sprite size. Use orthographic front elevation just above rail height; three separate straight sections with the bottoms of the rail posts aligned within each row. Wide transparent margins separating all three rows and around each whole section. True transparent canvas outside the drawings, no ground, no backdrop or sky, no road, no vehicles, no typography, no sheet markings, no shading outside silhouette. Each strip must be roughly four times wider than it is tall and self-contained.
```
