# Midnight Monsters

A pixel-art arcade racer with 16 monster drivers, eight haunted worlds and races for two to four players online or in local split-screen.

**[Play Midnight Monsters in your browser](https://cyrilbele.github.io/midnight_monsters/)**

Each race draws four different worlds in a new order. Look for the sphinx in Sarcophagus Express, the yeti bridge in Frostbite Falls, the giant at the traffic light in Monstropolis and the stamping presses in Foundry of the Damned. [Preview the four new worlds](https://cyrilbele.github.io/midnight_monsters/?compare=2)

## Race with friends

[Open the online lobby](https://cyrilbele.github.io/midnight_monsters/?online=1), choose 2, 3 or 4 players, create a room and share its invitation link. Once everyone has joined, the host chooses **Start race** and sends the same four-stage itinerary to every driver. Enable your microphone to talk or choose **Listen to voices** to listen. During the race, press **V** or **Y / △** on a gamepad to toggle your microphone. Keep the host’s tab open throughout the race.

## Run locally

From the project directory, run `python3 -m http.server 8642 --bind 127.0.0.1` and open [the game](http://localhost:8642/).

GitHub Pages publishes the game from the root of `main`. For track editing, translations and sprite sheets, see the [development guide](AGENTS.md).
