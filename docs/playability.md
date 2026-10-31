# Playability notes

This iteration reviews two well-known games' officially published input implementations. It adopts small design principles through original JavaScript implementations; no source code or assets were copied. This is a focused review, not a claim to benchmark all top games or to conduct a user study.

| Reference | Observation from the published source | Orbit Warden application |
| --- | --- | --- |
| [Celeste player code](https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs) | Jump grace timers, input-buffer consumption, and explicit assist settings make precise movement more forgiving. | Time-based pose confirmation replaces slow seven-frame voting; calibration, jitter rejection, and adjustable steering reduce the precision burden. Rookie flight and a safe Control Lab make learning easier. |
| [Mindustry mobile input](https://github.com/Anuken/Mindustry/blob/master/core/src/mindustry/input/MobileInput.java) | Mobile shooting distinguishes manual input from automatic targeting; valid targets are retained and the crosshair shows the selected target. | Optional aim assist retains a reachable target until it becomes invalid or significantly worse than another target; manual fire and unassisted aim stay available. |

Additional arcade design choices: telegraph the next boss volley before it fires; show the ship's vulnerable core; reward short kill chains; provide clear hit and pickup cues. Sound is opt-in and generated locally, and reduced motion removes shake/flashes. These decisions aim for a readable and forgiving game; whether they feel good across different hands and devices requires playtesting.

Validation uses deterministic Node tests for gesture geometry, time-based filtering, calibration, smoothing, power release, segment collisions, and target stability; Python logic regression tests; and Chromium checks for safe practice, camera controls, paused state, campaign transitions, sound opt-in, and touch release. Actual camera recognition is not established by simulated tracking.


## Expedition progression

The advanced release adds choices that change a run: three starting ships and two refit stations with six upgrades. Armed enemy squadrons and commander phase changes make encounters distinct, while locked attack warnings preserve a chance to dodge. Guided missiles provide limited burst damage; their magazine and cooldown prevent holding a gesture from continuously clearing encounters. Local pilot badges recognize milestones without increasing player power. Existing calibration, relaxed steering, difficulty, sound, and motion controls remain available.
