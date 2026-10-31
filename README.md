# Orbit Warden — neon orbital-defense game

[![Play Orbit Warden](https://img.shields.io/badge/PLAY%20NOW-ORBIT%20WARDEN-21c9e8?style=for-the-badge&logo=render&logoColor=white)](https://orbit-warden-1.onrender.com)

**Live web game:** [https://orbit-warden-1.onrender.com](https://orbit-warden-1.onrender.com)  
**Source code:** [github.com/arpitkjaiswal/orbit-warden](https://github.com/arpitkjaiswal/orbit-warden)

A polished, procedurally drawn 2D arcade defense game with **two editions**:

- **Browser edition** (`web/`): responsive Canvas + JavaScript, deployable on Render Static Sites, keyboard/touch inputs, opt-in MediaPipe webcam hand landmarks, and a visual gesture-control panel.
- **Desktop edition** (`orbit_warden/`): original Python/Pygame game, optional local MediaPipe control and trusted `.joblib` gesture classifier loading.

Both editions include asteroids, wave-moving drones, zigzag fighters, heavy armored tanks, collision detection, ship health, score/time/difficulty HUD, laser weapon, energy recharge beam, shields, cooldowns, particles, game-over, and restart.

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
| Missile salvo | C or on-screen button | Hold index/middle/ring extended, pinky folded, 0.55s |

Touch controls appear on smaller screens. Hand labels use time-based confirmation (80ms for basic poses, 160ms for power poses), calibrated steering, and adjustable smoothing. Keyboard steering overrides gestures, and the webcam is off by default. Browser webcam access requires **HTTPS** (Render provides this) or **localhost**, and permission from the player.

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
2. Open **Control Lab** for safe practice, enable the camera, hold one whole hand comfortably in view, and tap **Center my hand**. Relaxed steering (default) moves left/right in a flight lane; select Free flight for both axes. Increase Hand reach to travel farther with smaller hand movements. Choose Quick, Balanced, or Extra steady smoothing. Keyboard movement overrides the camera on each axis.
3. **Index finger:** fire. **Fist:** shield. **Open palm:** recharge quickly. **Thumb/index pinch with other fingers open, held 0.45 seconds:** overdrive. **Peace sign held 0.8 seconds:** nova. Release the power pose before using it again; cooldowns still apply. If a power is on cooldown, release and retry when its button says READY.
4. **Camera auto-fire**, enabled below the arena, shoots while steering or holding a power pose. Fist and palm stop auto-fire so you can defend and refill. Uncheck camera auto-fire for index-only shooting. Aim assist works with keyboard, touch, and camera alike.
5. Watch the camera's pose/confidence readout and HAND LINKED status. A hold percentage indicates power preparation. When the hand disappears or the feed stalls, camera movement and continuous powers stop; an already activated overdrive finishes its timed burst. Previously fired shots keep moving. Returning a hand must establish a new stable pose. The mission pauses after 0.8 seconds without a hand unless Pause when hand is lost is unchecked. Switching focus also pauses the mission.

Allow camera permission in browser site settings if denied. If model loading fails, verify access to `cdn.jsdelivr.net` and `storage.googleapis.com` and reload. Model/wasm files download on enable; images are processed on the device and this application does not upload camera frames. Keyboard and touch remain usable without camera assets. Actual webcam recognition and permission prompts require testing on the player's device; automated tests use synthetic landmarks and simulated tracking.

### Development validation

No package installation or build is needed for core browser gameplay. Start from the repository root with `python -m http.server 8000 --directory web`. Run `node --test web/tests/*.test.mjs` (Node 22 as in CI, or Node 24). For explicit per-test reporting on Node 24, use `node --test --test-isolation=none web/tests/*.test.mjs`. Also run `python -m unittest discover -s tests -v` and JavaScript syntax checks for `web/main.js`, `web/logic.js`, `web/gestures.js`, `web/gesture-logic.js`, `web/feedback.js`, and `web/adventure.js`. The new gesture tests cover pose geometry, hold/release gating, lost/frozen tracking, and camera shutdown. Desktop Pygame controls are unchanged.


## Flight feel and accessibility (v2.2)

- **Control Lab:** safe live steering and gesture practice. Your mission, health, cooldowns, position, and score remain frozen; Exit Control Lab returns you to the mission. Centering your hand during a mission pauses it so you can recalibrate safely. The camera stays opt-in.
- **Flight levels:** select Rookie (default), Standard, or Ace before launching. Rookie slows enemies and projectiles and gives you a smaller vulnerable core; Ace speeds up threats. Your vulnerable circle is outlined at the ship center; decorative wings do not take damage. The best score is a personal record across all flight levels.
- **Gesture stability:** basic poses confirm after 80ms of consistent input, power poses after 160ms. Nova and overdrive then require their normal holds. Keep a different pose for at least 0.2 seconds to rearm a power; a short ambiguous frame cannot rearm it. Camera detection runs at up to 25Hz; real latency also depends on the device. Detection loss clears continuous camera actions immediately; stalled feeds expire after 300ms.
- **Readable combat:** boss warning lines lock the next volley direction 0.4 seconds before firing. Dodge after the warning. Target assist retains a valid target instead of jumping between similar enemies. Projectile collision checks the full traveled segment so fast shots do not skip opponents between frames.
- **Kill chains:** destroy enemies within three seconds of the previous kill to build a chain. Every five consecutive kills raises the score multiplier, up to ×5. A hull hit or expired chain resets it. Boss bonuses remain fixed. The chain bar shows time remaining.
- **Feedback options:** enable Sound for quiet synthesized shot, pickup, hit, and power cues. It starts only after you opt in. Less motion disables screen shake and full-screen damage flashes. Neither option changes combat rules. Settings and calibration apply to the current page session.

For the design reasoning and public source references reviewed, see [playability notes](docs/playability.md). This iteration does not change the desktop Pygame edition. Real webcam lighting, hand diversity, occlusion, and permission behavior still need device testing; automated tests cover synthetic landmarks and simulated camera play.


## Advanced expedition release (v3.0)

Choose a ship and flight level before launch. Vanguard starts with five hull and twin lasers. Bastion starts with six hull, spread fire, and extra shield recovery. Spectre starts with four hull, plasma lance, and +1 gun damage. Weapon switching remains available for every ship.

Each sector has three waves over 30 seconds, including interceptor formations. Interceptors fire a telegraphed aimed shot; elite carriers have ten hull and a three-shot volley. No more than 28 normal enemies can be present at once. Commander health is 110/170/250. Sentinel's fan widens below half health; Ravager alternates aimed fans and radial rings; Overlord adds rotating rings in phase two. Attack directions are shown before firing, and all projectiles can be dodged or shielded.

**Homing missiles:** C or the missile button launches three guided projectiles using one magazine charge, with a three-second launch cooldown. Start with three charges. Each projectile deals eight damage in a 75-pixel blast area and retargets if its target dies. Three-finger camera gesture: extend index, middle, and ring with pinky folded for 0.55 seconds after pose confirmation, then release to rearm. Magazine charges do not regenerate during a sector. Boss refits add one charge up to five; the warhead upgrade fills the magazine. Overdrive now reduces gun energy costs by 60% during its six-second burst.

After the first and second commanders, combat pauses at a **refit station**. Pick one upgrade with a click/tap (or 1–3 while focus is in the dialog). The first station offers Quantum reactor (−25% gun cost, +8 passive energy/s), Titanium hull (+2 maximum hull and repair two), or Warhead array (+4 missile damage and full magazine). The second offers Accelerator (20% shorter gun cooldown), Wing drones (two support guns firing every 0.65 seconds), or Aegis matrix (+14 shield recovery/s and full shield). Boss victories also add one base gun damage, repair two hull, refill energy, and reset nova. Choices last for the current run; restarting resets the build. A refit dialog traps keyboard focus and cannot be bypassed with resume or Control Lab.

Six **pilot badges** persist in this browser: first intercept, a 20-kill chain, first commander, campaign completion, a sector without a hull hit, and ten missile kills in one run. They grant no combat bonus. Best score and badges are stored locally; private mode or cleared storage may erase them. The victory screen reports ship, score, kills, missile kills, and hull hits. The browser edition contains all expedition features; desktop Pygame remains its original survival edition.

### Release and deployment

The game is static, with no build or package installation required. The included Render Blueprint publishes `web/` and sets `Cache-Control: no-cache` so clients can revalidate files on reload. Blueprint headers apply only when the Render service uses/syncs this Blueprint; an existing differently configured service may require the same header in Render settings. No service worker is installed.

Push the tested release to the existing GitHub `main` branch. If the connected Render service has auto-deploy enabled for `main`, that push starts its deployment; otherwise choose **Manual Deploy → Deploy latest commit** in the existing Render dashboard. Do not create a second service merely to release an update. Verify `/` contains `v3.0`, `/adventure.js` exports `SHIPS`, and `/main.js` imports `adventure.js` on the live site, then start a run and check missiles and the refit flow. A successful Git push alone does not prove a successful Render deployment. Live-site requests require environment access to `orbit-warden-1.onrender.com`; GitHub deployment status requests require `api.github.com`. Save/review the corresponding network settings if blocked. Secure Render API or deploy-hook bindings are required for direct dashboard-independent deployment; never place their values in source or chat.


## Shared game and camera view (v3.0.1)

The live camera is docked inside the same cockpit frame as the arena: beside it on desktop and directly beneath it on phones. Pose feedback, camera enable/disable, hand centering, and power hold progress stay with the feed. Open **Tune controls & gesture guide** for reach, smoothing, steering mode, and camera help. The camera remains off until explicitly enabled; this layout reuses the same video and tracking canvas rather than opening another stream.


## Reliability fixes (v3.0.2)

Keyboard keys and individual touch pointers are now tracked separately, so releasing one control cannot cancel another held control. Touch input in Control Lab stays in practice; holding Space from standby starts the mission and keeps firing. Shortcuts work after clicking camera/action buttons while text fields, selectors, and native button activation keep normal keyboard behavior.

Nova and missile splash stop immediately at victory and refit boundaries. Projectiles hit the nearest enemy along their traveled path. Camera cancellation releases pending resources; disconnects and tracking failures pause an active mission with a recovery message. The hand overlay follows the actual video dimensions, including portrait cameras. No physical webcam is enabled by the automated checks.

Run the normal unit tests as documented above. For the reusable full browser regression suite, run `node scripts/browser-smoke.cjs` from the repository root. It requires an available Playwright package and Chromium (the cloud environment already provides both); optionally set `CHROMIUM_PATH` to an installed Chromium executable. It starts and closes its own local test server. The suite covers input regressions, synthetic camera permissions/disconnects and portrait video, campaign progression, refits, achievements, touch controls, and six cockpit screen sizes. Physical hand recognition and a live Render release require separate device/live-site validation. CI runs the Node/Python suites and all application JavaScript syntax checks; the optional browser suite runs separately.


## Friendly play and verified releases (v3.1.0)

The start screen now offers **Play now** and **Try hand controls first**. Keyboard players can start immediately; optional ship, difficulty, sound and motion settings live under **Ship, difficulty & accessibility**. Pause/Resume, Restart and Practice controls are visible above the shared game/camera frame. Phone touch controls sit on the arena, so steering and firing do not require scrolling away from play. Camera controls stay optional and explain permission, missing-device and busy-device errors in plain language; an active mission pauses safely if tracking cannot start.

To try hand play: select **Try hand controls first**, enable the camera, center your hand, and practice. **Back to start** returns to the Play now screen. During a run, **Practice controls** freezes combat and **Back to game** returns to the mission. Advanced mechanics and keyboard shortcuts remain available.

The owner confirmed that the existing Render service auto-deploys GitHub `main`. After tests pass on a main-branch push, the **Verify public Render release** job waits up to ten minutes for every critical public game file to match the checkout byte for byte. It checks the HTML, version manifest, application modules and stylesheet with cache revalidation. A current HTML page with stale JavaScript fails verification. Obsolete workflow runs are cancelled when a newer push arrives. This checks deployment, not physical webcam recognition.

Run `python scripts/verify_deployment.py --url http://127.0.0.1:8000` against a prepared local server, or `python scripts/verify_deployment.py --wait 600` for the public Render site. TLS verification and inherited proxy settings remain enabled. Updating a release requires changing both the visible version in `web/index.html` and `web/version.json`; tests enforce agreement. GitHub Actions can perform the public check independently of this cloud session's outbound network restrictions. Inspect **Game checks → Verify public Render release** before calling a public rollout successful. If the check fails, inspect the existing Render service's deploy logs; do not create a duplicate service.
