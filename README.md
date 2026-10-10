# Equator Drive

A small driving toy: one straight road that follows the real equator. Most of the planet along that line is ocean, so the trip is a long causeway with occasional countries, cities, weather, and wildlife. You can drive, ride a bicycle, or leave it on autopilot and watch.

It is a personal prototype, meant to be opened and played, not a simulation of real highways.

## Run it

No install and no build step. [Three.js r158](https://github.com/mrdoob/three.js/releases/tag/r158) is already in `lib/`.

Open `index.html` in a desktop browser (double-click the file, or serve the folder with any static server). Click the page or press a key to start the sound. The browser will not play audio until you do.

Choose a start on the title screen: the Ecuador coast, the Kenya highlands, or Pontianak in Indonesia. If this browser already has a save, you can continue that trip. Switch language with **中文 / English** on the title screen or in the trip panel. The choice is remembered.

Progress, passport stamps, and photo thumbnails are stored in `localStorage` for this origin. A full-size photo is also downloaded when you save a shot.

## Controls

| Key | Action |
| --- | --- |
| W / S | Accelerate or brake. On autopilot, this changes the cruise speed. |
| A / D | Steer, or change lane on autopilot. |
| Space | Toggle autopilot. |
| V | Car or bicycle. |
| C | Chase, side, first person, aerial. Drag to look around. Wheel to zoom. |
| 1 – 5 | Geographic scale: ×1, ×20, ×100, ×500, ×2000. Default is ×100. |
| T | Time speed, including pause. |
| R | Clear, cloudy, or thunderstorm. |
| M / B | Mute, and music. |
| N | Skip to the next stretch of land. |
| P | Photo mode, then P again to save. |
| J | Travel journal. |
| G | Bottom strip: the road stays at the bottom of the screen. |
| H / F | Hide the interface, or full screen. |
| Esc | Leave photo mode, the strip, or the journal. |

## What is in the drive

- Longitude is mapped onto a straight road. The countries, seas, a few cities, and a few landmarks use real positions. The scenery around them is invented.
- At ×100, one real kilometer is about ten meters of road, so a loop of the equator is a long sitting but not a real 40,000 km drive. ×1 is true scale.
- Ocean sections have dolphins, a whale that surfaces beside the road, flying fish, boats, rigs, and lighthouses.
- Land sections change by region: forest, savanna, highlands, roadside buildings, herds, and a few river bridges. The animals follow the biome: giraffe, elephant, and zebra on the savanna, llama in the Andes, capybara and tapir in the Amazon, gorilla in the Congo forest, orangutan in Indonesia, tortoise and iguana on the volcanic islands.
- Weather, a day and night cycle tied to local solar time, and procedural engine, wind, weather, and music, all from the Web Audio API. There are no audio files.
- A passport stamp for each country, a journal of stamps and photo thumbnails, and a short pause when a full equator loop is completed.

Other traffic on the road is occasional: one moving vehicle at a time, then a quiet gap. Trucks, buses, and bicycles roll on wheels. Driving into one breaks it into small cubes, and it is gone. Trucks, cars, and bicycles parked off the road stay still. They are scenery.

## Project layout

```
index.html          page, HUD, title screen
lib/three.min.js    Three.js r158
src/main.js         loop, input, camera, save, journal
src/geo.js          equator geography
src/world.js        sky, water, chunks, landmarks
src/car.js          car and bicycle
src/traffic.js      the other vehicles
src/sealife.js      dolphins, whales, flying fish
src/weather.js      clouds, rain, lightning
src/audio.js        procedural sound and music
src/compose.js      contact-shadow pass
src/i18n.js         Chinese and English text
```

There is no bundler. Each file attaches itself to `window.ED`.

## Notes for anyone reading the code

The road is rebuilt in chunks and recentered every couple of kilometers so coordinates stay small. Shared materials and instanced trees keep the scene light. The contact-shadow pass is a small fullscreen shader, not a postprocessing library, because the Three.js examples build is not included.

Saves use the key `equator-drive-v1`. Journal thumbnails use `equator-drive-journal`. Language uses `equator-drive-lang`. Opening the file directly (`file://`) and opening it from a local server do not share that storage.

## Development notes

[DEVLOG.md](DEVLOG.md) records what each version added and what it changed.
