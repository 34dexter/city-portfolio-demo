# Punith B · City Portfolio

A drive-around 3D portfolio. Visitors steer a small car through a low-poly city. Each district holds one part of the résumé, and pressing Enter at its marker opens the details.

## Run it

```bash
npm install
npm run dev       # local dev server
npm run build     # production build in dist/
npm run preview   # serve the production build
```

## Edit the content

All text lives in `src/data/resume.js`: profile, skills, experience, projects, education and contact links.

- **LinkedIn:** set in `profile.linkedin`. It appears on the Contact panel and the signpost; leave it empty to hide it.
- **Phone:** left out on purpose. Add it to `profile.phone` if you want it public.

## The districts

| District | Content | In the world |
| --- | --- | --- |
| Landing | About me | Your name in 3D letters you can knock over, plus a ramp |
| Skills | Technical skills | One crate per skill, grouped by category, all pushable |
| Internship | Take It Smart, ML intern | Office tower, beating heart, ECG trace, a "random forest" |
| Sports Data Analyst | HUDL India | Football pitch and stands; push the ball into a goal |
| Education | BE in ECE, RRCE 2023 | College hall with a floating graduation cap |
| Event Planner | Eventrra project | Stage, balloons, string lights; links to the live site |
| Bone Cancer Prediction | DNN / VGG16 project | Lab, giant microscope, animated neural network, a bone |
| Solar Tracker | Arduino project | Dual-axis panel that follows the in-game sun |
| Contact | Email, portfolio, GitHub | Post office, red pillar post box, signpost |

The menu (Esc), the minimap and the "Read as résumé" button give visitors who don't want to drive a quick way to all the content.

## Controls

WASD / arrows drive · Shift boost · Space jump · B brake · Enter open · H honk · R respawn · C first-person / top-down view · T weather · N day/night · L mute · mouse drag/wheel to look around. Phones get a joystick and buttons, and every toggle has a button in the top bar.

## Camera and weather

- **First-person view (C or 👁️):** a driver's view over the hood. Drag to look around; the view eases back to the road when you drive. Opening a district still switches to the top-down framing, then returns.
- **Weather (T or 🌦️):** cycles Auto → Clear → Rain → Snow. On Auto, the weather changes by itself every 2 to 4 minutes. Rain brings a grey sky, closer fog, lightning with thunder and a bit less grip. Snow covers the ground and rooftops over about 20 seconds and makes the roads slippery.

## Stack

- [Three.js](https://threejs.org) (WebGL) for rendering. Every model is built in code, so there are no 3D files to load.
- [Rapier](https://rapier.rs) for physics, using its raycast vehicle controller.
- [GSAP](https://gsap.com) for camera transitions.
- [Vite](https://vite.dev) for the build.
- Sounds are synthesized with WebAudio, so there are no audio files either.

## Deploy to GitHub Pages

Live site: https://34dexter.github.io/city-portfolio-demo/

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes it to GitHub Pages. To update the site, commit your changes and push. The new version is live a minute or two later.

`vite.config.js` uses relative paths (`base: './'`), so `dist/` also works from any other host or folder.

## Credits

Inspired by [Bruno Simon's portfolio](https://bruno-simon.com). The vehicle tuning values and the flip-recovery logic are adapted from [folio-2025](https://github.com/brunosimon/folio-2025) (MIT License, © 2025 Bruno Simon). The 3D letter font is Helvetiker from the three.js examples.
