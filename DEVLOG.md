# Development log

Equator Drive was built as a series of playable versions. Each one stayed a single folder of static files: open `index.html`, no build. This log is the record of what shipped, what was added, and what was changed.

Geography is real in longitude only. The road, buildings, animals, and landmarks are simple stand-ins, not models of the actual places.

## Version 1 — A road you can drive

The first playable prototype.

**Added**

- A straight road whose distance maps to longitude along the equator, starting in the Pacific just west of Ecuador.
- A car with manual driving and autopilot, and a chase camera.
- Country and sea names beside the road, a progress bar for one loop, and a small map of land and ocean.
- A day and night cycle from local solar time.
- Distance scales so a full loop can be a real 40,075 km or a shortened drive. The default is ×100.
- Chunked scenery that is built ahead of the car and recentered so the scene does not drift into floating-point jitter.

**Changed**

- Nothing yet. This was the first version.

## Version 2 — Ocean, bicycle, weather, and sound

The second pass filled the long ocean stretches and made the drive something you can listen to.

**Added**

- Dolphins that pace the car, distant whales, and flying fish.
- Boats, oil rigs, and lighthouses, and a readout for distance to the next land.
- Clear, cloudy, and thunderstorm weather, with rain, lightning, and a wet road.
- A bicycle, with its own speed and a pedaling motion.
- Procedural audio: engine or coasting, wind, waves, rain, thunder, insects, birds, and a generated loop of music. No audio files. Sound starts only after a click or a key, which is a browser rule.

**Changed**

- The music was quiet at first and was later turned up.
- Palm trees were limited to the coast. They had been appearing on every inland road.
- Night clouds were too bright, and the headlights were strengthened so the road stayed readable after dark.

## Version 3 — Land, collection, and leaving it running

The third pass gave the land a reason to look different from one country to the next, and a reason to keep a trip.

**Added**

- Regional ground and trees, roadside houses (Andean, Amazonian, African, and Indonesian forms), and savanna herds.
- River gaps at the Amazon and the Congo, with a cable bridge when the gap is wide enough in game meters.
- Distant peaks and a handful of equator monuments moved close enough to the road to see.
- Passport stamps for twelve countries, saved in the browser.
- A photo download, and a bottom-strip mode that leaves the road along the lower edge of the screen so the rest can stay empty.

**Changed**

- Landmarks used to be announced when they were already beside or behind the camera. The notice now comes while they are still ahead, and the monuments sit closer to the road.
- The ground was a flat green sheet. It gained dirt, a gravel shoulder, tufts, bushes, and rocks.
- Mouse look orbited a point ahead of the car, which felt unmoored. It now orbits the vehicle. First person looks around from the seat.
- The strip mode had an unclear name and a toast that disappeared. It is labeled as a bottom strip, and the empty area above the road explains itself on screen.

## Version 4 — Picture, and a trip with a start and an end

The fourth pass answered two requests together: the picture felt too rough, and the drive needed a beginning, other people, a journal, and a finish.

**Added**

- A visual pass that stays inside the same scene: smooth shading, filmic tone mapping, a denser roadside mesh, a small repeating ground texture, a soft contact-shadow pass, and a slight difference between the road and the foliage.
- A title screen with three starts (Ecuador, Kenya, Indonesia) and, when a save exists, continue. A new start keeps stamps and photos and resets the odometer.
- Other traffic, a travel journal opened with J (stamps plus small photo copies, capped so storage does not fill up), and a pause when one equator loop is completed. Driving can continue, and the counter rolls into the next loop.

**Changed**

- Traffic was too frequent, and meeting another vehicle sped it up to match you, so you pushed it along forever. There is now one vehicle at a time, with a long gap. It keeps its own speed and slides aside if you draw level.
- Whales were a small shape far from the road. A whale now rises beside the causeway, shows a long back, spouts, stays with you for a while, and sinks.
- The first brightness pass raised the ambient light and softened the contact shadows, which had been crushing shade under trees. Night was still too dark after that; the next version continues the fix.

## Version 5 — Night, sea traffic, and two languages

This pass is the one prepared for showing the project to other people.

**Added**

- Chinese and English. The title screen and the trip panel both have a language switch. The choice is stored in the browser. Place names, signs, toasts, the journal, and the help text follow it. Saved stamps stay in one internal form and are translated when shown.
- This log, and a README that says how to open the game.

**Changed**

- Night no longer drops to a black sky with a headlight cone and nothing else. The night sky and the horizon fog are blue, the sea keeps a blue body after dark, and the fill light is strong enough that trees, rails, and the road stay visible.
- Forest shade uses a stronger sky fill, so a tree tunnel is dim rather than black.
- Trucks and bicycles on a sea crossing were parked past the guardrail, which put them in the water. Over open sea they now use lanes on the causeway. On land they can still wait on the shoulder. If a shoulder vehicle reaches the sea, it is pulled back onto the deck.
- A whale used to fall behind the car, out of the forward view, and its spout was a solid white cone. It now stays ahead and to the side, and the spout is only the spray.
- Meeting another vehicle no longer passes through it. The vehicle breaks into small cubes and disappears.

## Version 6 — Roadside fixes before sharing

This pass is the one after playing the build, before putting the folder on GitHub.

**Changed**

- The road is a little wider, so the guardrails sit on the pavement instead of hanging past the edge.
- A whale stays about one car-width off the road. Its back and tail clear the rail, and the spout is spray rather than a solid white cone.
- Vehicles on the road move, and they have wheels that roll. Driving into one still breaks it into cubes. Trucks, cars, and bicycles off the road are parked scenery and do not move.
- Trees on distant slopes were floating. The ground mesh was coarser than the height function, so a tree planted at the true height sat above the visible slope. Trees, herds, and parked vehicles now sit on the slope you can see, and very steep faces are left bare.
- Herds are no longer only giraffes and elephants. Savanna has giraffe, elephant, and zebra. Grassland and highland have zebra and cattle. The Andes have llamas. The Amazon has capybara and tapir. The Congo forest has gorillas. Indonesia has orangutans. The Galápagos have tortoises and iguanas. Tropical coasts have iguanas.

## How to read the versions

Versions 1 through 3 are the playable idea, the ocean and the sound, then the land and the collection. Version 4 is the picture and the shape of a trip. Version 5 makes night, sea crossings, and language presentable. Version 6 is the pass that cleans up the road, the animals, and the other vehicles before the project is shared.
