# Fracture-energy presets

The presets configure critical fracture energy Gc (J/m²). This is distinct from
the stress-intensity fracture toughness KIC (MPa√m).

| Preset         | Gc (J/m²) | Crack energy at 10 mm (J/m) | Source                          |
| -------------- | --------: | --------------------------: | ------------------------------- |
| Glass          |         7 |                        0.07 | [Roylance, Table 2, p. 9][mit]  |
| Ice (−13°C)    |       1.5 |                       0.015 | [Goodman and Tabor, §4(i)][ice] |
| Acrylic (PMMA) |       500 |                           5 | [Roylance, Table 2, p. 9][mit]  |
| Polystyrene    |       400 |                           4 | [Roylance, Table 2, p. 9][mit]  |

The MIT table reports kJ/m²: glass 0.007, PMMA 0.5 and polystyrene 0.4.
The ice measurement is 1.5 ± 0.2 J/m² from three-point bending at −13°C.
These are representative values; composition, temperature and loading rate
can change measured fracture properties.

The 2D solver uses `Gc × thicknessMm / 1000` J/m: a crack of in-plane length L
creates a projected fracture area `L × thickness`. Gc already accounts for
both crack faces; no additional factor of two is applied.

Glass at 10 mm is the initial selection. Custom initially holds 1,000,000 J/m²,
which reproduces the previous 10,000 J/m setting at 10 mm. Switching presets
retains thickness and the stored Custom value. Editing Gc selects Custom.
Reset retains both selections. The Gc slider spans 0.1–1,000,000 J/m² on a
logarithmic scale; thickness spans 0.1–100 mm. These are empirical UI bounds.

Presets change fracture-energy inputs. Body areal density defaults to 25 kg/m²,
is separately adjustable under World, and is not changed with the preset or thickness. The normal-impact energy rule and
minimum fragment area remain simplified; these values do not calibrate the
simulation's full dynamic response to an actual material test. In particular,
the real-glass default fractures more readily than the previous custom setting.
The plate starts asleep with its bottom touching the floor, avoiding a startup
impact; pointer tools, collisions and gravity changes can wake it.

[mit]: https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/e5bca953e1dbd0cd0376f0f77033dc0d_MIT3_11F99_frac.pdf#page=9
[ice]: https://www.cambridge.org/core/journals/journal-of-glaciology/article/fracture-toughness-of-ice-a-preliminary-account-of-some-new-experiments/87E062E1284661430F7346A643015532
