# Orbit Warden — neon orbital-defense game

[![Play Orbit Warden](https://img.shields.io/badge/PLAY%20NOW-ORBIT%20WARDEN-21c9e8?style=for-the-badge&logo=render&logoColor=white)](https://orbit-warden-1.onrender.com)

**Live web game:** [https://orbit-warden-1.onrender.com](https://orbit-warden-1.onrender.com)  
**Source code:** [github.com/arpitkjaiswal/orbit-warden](https://github.com/arpitkjaiswal/orbit-warden)

A polished, procedurally drawn 2D arcade defense game with **two editions**:

- **Browser edition** (`web/`): responsive Canvas + JavaScript, deployable on Render Static Sites, keyboard/touch inputs, opt-in MediaPipe webcam hand landmarks, and a visual gesture-control panel.
- **Desktop edition** (`orbit_warden/`): original Python/Pygame game, optional local MediaPipe control and trusted `.joblib` gesture classifier loading.

Both editions include asteroids, wave-moving drones, zigzag fighters, heavy armored tanks, collision detection, five starting HP, score/time/difficulty HUD, laser weapon, energy recharge beam, shields, cooldowns, particles, game-over, and restart.

## Play the browser edition locally

From the repository root:

```sh
python -m http.server 8000 --directory web
```

Open **http://localhost:8000**. There is no `npm install` step for core gameplay. Google Fonts and optional webcam MediaPipe model assets are loaded from external URLs; keyboard gameplay works without them.

### Browser controls

| Action | Keyboard | Gesture (optional) |
| --- | --- | --- |
| Move | Arrow keys or WASD | Move hand left/right and up/down |
| Shoot | Space | Index finger only |
| Recharge beam | E | Open hand (four fingers extended) |
| Shield | Shift | Closed fist |
| Pause/resume | P | Keyboard only |
| Restart | R | Keyboard only |
| Overdrive | Z or on-screen button | Hold thumb/index pinch 0.45s |
| Nova | X or on-screen button | Hold peace sign 0.8s |

Touch controls appear on smaller screens. Hand labels use a seven-frame majority vote, confidence threshold, and smoothed palm position. Keyboard steering overrides gestures, and the webcam is off by default. Browser webcam access requires **HTTPS** (Render provides this) or **localhost**, and permission from the player.

Gestures are heuristic classifications built on a pre-trained MediaPipe hand-landmark detector. **The custom trained gesture model was not provided, so its weights are not included.**

## Deploy the browser edition to Render

The published deployment URL is **[orbit-warden-1.onrender.com](https://orbit-warden-1.onrender.com)** (provided by the project owner). The site's live health was not independently verified during this documentation update.

The included `render.yaml` defines a **Render Static Site** that publishes `./web`. It requires no GUI server or running Python process.

1. In your Render account choose **New → Blueprint**, connect this `arpitkjaiswal/orbit-warden` GitHub repository, and apply `render.yaml`.
2. Alternatively choose **New → Static Site**, select this repository and the `main` branch, set **Publish Directory = web** and **Build Command = echo ready**.
3. Open [the live deployment](https://orbit-warden-1.onrender.com) and grant webcam permission only if you want optional gesture controls. Automatic deploys can be enabled for further pushes.

**Do not run the Pygame desktop window as a Render Python web service**; desktop GUI apps are not browser pages. The browser edition is a JavaScript port sharing the same gameplay concepts.

## Troubleshooting an existing Render Python Web Service

If you already created a **Python Web Service** instead of a Static Site, you can deploy the browser edition without installing Python dependencies. In **Render Dashboard → your service → Settings**, change:

| Field | Value |
| --- | --- |
| Root Directory | Leave empty |
| Build Command | `echo "Build complete"` |
| Start Command | `python -m http.server ${PORT:-10000} --bind 0.0.0.0 --directory web` |

Save the settings, then choose **Manual Deploy → Clear build cache & deploy**. This uses Python's built-in HTTP server and binds to Render's `PORT` on `0.0.0.0`, so it requires **no additional Python packages**. The existing `requirements.txt` is strictly for the desktop Pygame edition.

If the build reports `sdl2-config: not found` or `Unable to run "sdl-config"`, the build is still executing `pip install -r requirements.txt`. Remove that build step instead of installing SDL or changing the Pygame dependency. A Static Site remains the preferred deployment method.

## Run the Pygame desktop edition

```sh
python -m pip install -r requirements.txt
python -m orbit_warden
```

Enable optional native webcam mode:

```sh
python -m pip install -r requirements-gestures.txt
# If required by your MediaPipe Tasks version, provide the hand landmarker task:
export ORBIT_HAND_LANDMARKER=/path/to/hand_landmarker.task
python -m orbit_warden
```

Press **G** to toggle webcam tracking. A *trusted compatible* previously trained Python gesture classifier can be loaded by setting `ORBIT_GESTURE_MODEL=/path/to/model.joblib`. It must accept 63 numeric (x,y,z) hand landmark features and predict `move`, `fire`, `shield`, `recharge`, or `none`. **Never load untrusted joblib files.** A Python classifier does not automatically run in a static browser deployment.

## Quality checks

After pushing, review [GitHub Actions](https://github.com/arpitkjaiswal/orbit-warden/actions) for the CI status. To test the hosted game, visit [the Render URL](https://orbit-warden-1.onrender.com) and verify the game loads, keyboard inputs work, and (if enabled) webcam permissions can be granted. Live browser hardware testing is separate from the unit tests.

```sh
python -m unittest discover -s tests -v
node --test web/tests/*.test.mjs
node --check web/main.js
node --check web/logic.js
node --check web/gestures.js
```

GitHub Actions runs these checks on pushes and pull requests. Browser visuals and webcam hardware still require live-device validation.

## Project structure

```text
.
├── render.yaml
├── .github/workflows/checks.yml
├── web/
│   ├── index.html
│   ├── style.css
│   ├── main.js
│   ├── gestures.js
│   ├── logic.js
│   └── tests/logic.test.mjs
├── orbit_warden/
│   ├── __main__.py
│   ├── game.py
│   ├── logic.py
│   └── gestures.py
├── requirements.txt
├── requirements-gestures.txt
└── tests/test_logic.py
```

## Browser adventure campaign (v2)

The browser edition now features three sectors: **Outer Rim → Crimson Nebula → Void Citadel**. Survive 30 seconds per sector to summon its commander, then defeat it to advance. Defeat the Overlord to complete the campaign. Boss victories restore two hull points, refill energy, reset nova, and upgrade all weapons for the current run. Restart begins a fresh campaign; your best score stays saved locally.

- **Arrows / WASD:** move horizontally and vertically.
- **1 / 2 / 3:** switch between efficient twin lasers, a three-way spread, and heavy plasma lance. The buttons below the arena also switch weapons.
- **Q:** dash left when steering left, otherwise right, with brief invulnerability (4-second cooldown).
- **X:** nova deals 30 damage to every enemy and clears hostile projectiles (18-second cooldown).
- **Salvage:** every fifth regular kill drops a repair, energy, or shield pickup. Fly into it to collect it.
- **Commanders:** aimed five-shot volleys, increasing hull strength, visible health bars, and sector rewards.

Touch controls include vertical movement, dash, and nova. Existing fire, shield, recharge, pause, and gesture controls remain available. These campaign additions apply to the browser edition; the original desktop edition keeps its survival gameplay.

## Aegis ship and camera combat (v2.1)

The browser ship now has armored wings, twin cannons, animated engines, banking, a target reticle, and a rotating overdrive aura. Salvage within 140 game pixels is drawn toward the ship. **Aim assist** (enabled below the arena) aims toward the nearest enemy ahead within the cannons' turning limit; uncheck it for straight manual shots.

**Z / OVERDRIVE** activates six seconds of double firing speed and +1 damage per projectile, refills weapon energy, and starts a 16-second cooldown. Its golden cannons and engine aura indicate when it is active. All weapons benefit; it does not grant invulnerability. Q remains the invulnerable dash and X remains nova. Overdrive, nova, and dash buttons work with mouse or touch.

### Camera quick start

1. Start the mission, press **G** or **Enable camera control**, and allow camera permission. Use HTTPS or localhost. The camera stays off until requested; disable with G or the same button.
2. Keep one whole hand visible in good light, fingers pointing upward. Move the hand left/right and up/down to fly. Movement uses a central camera area so you do not have to reach the edges. Keyboard movement overrides the camera on each axis.
3. **Index finger:** fire. **Fist:** shield. **Open palm:** recharge quickly. **Thumb/index pinch held 0.45 seconds:** overdrive. **Peace sign held 0.8 seconds:** nova. Release the power pose before using it again; cooldowns still apply. If a power is on cooldown, release and retry when its button says READY.
4. **Camera auto-fire**, enabled below the arena, shoots while steering or holding a power pose. Fist and palm stop auto-fire so you can defend and refill. Uncheck camera auto-fire for index-only shooting. Aim assist works with keyboard, touch, and camera alike.
5. Watch the camera's pose/confidence readout and HAND LINKED status. A hold percentage indicates power preparation. When the hand disappears or the feed stalls, camera movement and continuous powers stop; an already activated overdrive finishes its timed burst. Previously fired shots keep moving. Returning a hand must establish a new stable pose. Switching tabs pauses the mission.

Allow camera permission in browser site settings if denied. If model loading fails, verify access to `cdn.jsdelivr.net` and `storage.googleapis.com` and reload. Model/wasm files download on enable; images are processed on the device and this application does not upload camera frames. Keyboard and touch remain usable without camera assets. Actual webcam recognition and permission prompts require testing on the player's device; automated tests use synthetic landmarks and simulated tracking.

### Development validation

No package installation or build is needed for core browser gameplay. Start from the repository root with `python -m http.server 8000 --directory web`. Run `node --test web/tests/*.test.mjs` (Node 22 as in CI, or Node 24). For explicit per-test reporting on Node 24, use `node --test --test-isolation=none web/tests/*.test.mjs`. Also run `python -m unittest discover -s tests -v` and JavaScript syntax checks for `web/main.js`, `web/logic.js`, `web/gestures.js`, and `web/gesture-logic.js`. The new gesture tests cover pose geometry, hold/release gating, lost/frozen tracking, and camera shutdown. Desktop Pygame controls are unchanged.
