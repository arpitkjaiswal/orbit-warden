# Orbit Warden — neon orbital-defense game

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
| Move | Left/Right or A/D | Move hand left/right |
| Shoot | Space | Index finger only |
| Recharge beam | E | Open hand (four fingers extended) |
| Shield | Shift | Closed fist |
| Pause/resume | P | Keyboard only |
| Restart | R | Keyboard only |

Touch controls appear on smaller screens. Hand labels use a seven-frame majority vote, confidence threshold, and smoothed palm position. Keyboard steering overrides gestures, and the webcam is off by default. Browser webcam access requires **HTTPS** (Render provides this) or **localhost**, and permission from the player.

Gestures are heuristic classifications built on a pre-trained MediaPipe hand-landmark detector. **The custom trained gesture model was not provided, so its weights are not included.**

## Deploy the browser edition to Render

The included `render.yaml` defines a **Render Static Site** that publishes `./web`. It requires no GUI server or running Python process.

1. In your Render account choose **New → Blueprint**, connect this `arpitkjaiswal/orbit-warden` GitHub repository, and apply `render.yaml`.
2. Alternatively choose **New → Static Site**, select this repository and the `main` branch, set **Publish Directory = web** and **Build Command = echo ready**.
3. Open your Render HTTPS URL to play and grant webcam permission only if you want optional gesture controls. Automatic deploys can be enabled for further pushes.

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
