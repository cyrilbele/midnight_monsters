# Trailer

`midnight-monsters-trailer.mp4` : 18 secondes en anglais, 1920 × 1080 à 60 images par seconde, avec la musique du jeu *Vespers at Redline*.

Chaque plan est filmé dans le vrai jeu. `index.html` charge le jeu dans un cadre caché et y injecte `director.js`. Ce script fait avancer la course d’un pas de simulation par image, avec le pilote automatique, le garage, l’écran partagé à quatre et l’arrivée. Il dessine chaque image en 854 × 480, soit du 16:9 sur les 480 lignes du jeu. ffmpeg les agrandit ensuite en 1080p sans flou.

## Refaire la vidéo

Depuis la racine du projet :

```sh
python3 trailer/capture_server.py
```

Ouvrir [http://127.0.0.1:8643/trailer/?run=1](http://127.0.0.1:8643/trailer/?run=1). La page capture les 1 100 images dans `trailer/build/frames/`, puis le serveur écrit la vidéo. Il faut environ deux minutes. ffmpeg doit être installé.

| Adresse | Résultat |
| --- | --- |
| `?run=1` | Capture complète et encodage. |
| `?contact=1` | Planche d’une image par temps dans `trailer/build/preview/contact.png`. |
| `?t=2,7.5` | Une image par instant demandé, en secondes, dans `trailer/build/preview/`. |

Pour réencoder les images déjà capturées, sans recapture, lancer `python3 trailer/capture_server.py --encode`.

## Modifier le montage

Tout se règle dans `director.js`. Le montage suit le tempo de la musique, 144 BPM : un temps dure 25 images et une mesure 100 images.

- Les constantes `MONSTERS`, `WORLDS`, `SUNRISE`, `PLAYERS`, `FLAG` et `END` placent le début de chaque séquence, en images. `SHOTS` associe chaque séquence à son plan. Un plan de course indique l’univers, le pilote, le décalage depuis le repère de l’univers en segments et les rivaux proches.
- `ROSTER` et `PAGE` règlent le plan *16 MONSTERS* : le garage en deux pages de huit, chaque bolide tournant sur son plateau. Une nouvelle case apparaît tous les demi-temps.
- `WORLD_CUTS` règle le plan *8 HAUNTED WORLDS*, une grille de 4 × 2 où une course tourne dans chaque univers. Pour chaque case, il donne le pilote, les rivaux et le point de départ. Une nouvelle case apparaît tous les demi-temps.
- `CAPTIONS` contient les textes, `FLASHES` les éclairs de transition et `endShot` le carton final avec l’adresse du jeu.
