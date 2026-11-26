# Fracture-energy presets

The presets configure critical fracture energy Gc (J/m²). This is distinct from
the stress-intensity fracture toughness KIC (MPa√m).

| Preset         | Gc (J/m²) | Crack energy at 10 mm (J/m) | Source                          |
| -------------- | --------: | --------------------------: | ------------------------------- |
| Glass          |         7 |                        0.07 | [Roylance, Table 2, p. 9][mit]  |
| Ice (−13°C)    |       1.5 |                       0.015 | [Goodman and Tabor, §4(i)][ice] |
| Acrylic (PMMA) |       500 |                           5 | [Roylance, Table 2, p. 9][mit]  |
| Polystyrene    |       400 |                           4 | [Roylance, Table 2, p. 9][mit]  |
| Steel (mild)   |    12,000 |                         120 | [Roylance, Table 2, p. 9][mit]  |
| Rubber         |    13,000 |                         130 | [Roylance, Table 2, p. 9][mit]  |
| Wood           |       120 |                         1.2 | [Roylance, Table 2, p. 9][mit]  |

The MIT table reports kJ/m²: glass 0.007, PMMA 0.5, polystyrene 0.4, mild steel 12, rubber 13 and wood 0.12.
The ice measurement is 1.5 ± 0.2 J/m² from three-point bending at −13°C.
These are representative values; composition, temperature and loading rate
can change measured fracture properties.

The 2D solver uses `Gc × thicknessMm / 1000` J/m: a crack of in-plane length L
creates a projected fracture area `L × thickness`. Gc already accounts for
both crack faces; no additional factor of two is applied.

Glass at 10 mm is the initial selection. Choosing a preset loads its fracture
energy, volumetric density, friction, restitution, stiffness, tensile strength and crush behaviour and keeps the thickness;
moving any of those sliders selects Custom, and landing on a preset's values
names the preset again. The density slider spans 10–20,000 kg/m³ so that foam fits. The Gc slider spans 0.1–1,000,000 J/m² on a
logarithmic scale; thickness spans 0.1–100 mm. These are empirical UI bounds.

The object and the floor pick from one list: every object material is also a
floor material with the same friction and restitution, and the floor adds
Default.

Gc is sourced for every preset in the table above except concrete (100 J/m²,
chosen empirically). The densities, friction and restitution of all presets,
and the Default floor in `src/sim/floor-material.ts`, are representative values
chosen empirically with no fixed source. Glass and the Default floor keep the
friction 0.5 and restitution 0 the app had before materials existed.

Areal density is `density × thickness / 1000` kg/m², so glass at 2500 kg/m³ and
10 mm is the former 25 kg/m². Thickness therefore scales both mass and crack
energy; for a simple impact on the floor the two largely cancel. The supported
areal density is the product of the density and thickness slider limits, so
every slider position stays inside it.

The normal-impact energy rule and minimum fragment area remain simplified;
these values do not calibrate the simulation's full dynamic response to an
actual material test. The plate starts asleep with its bottom touching the
floor, avoiding a startup impact; pointer tools, collisions and gravity
changes can wake it.

## Strength, stiffness and crushing

Each preset also carries a Young's modulus `youngModulusPa` and a tensile
strength `tensileStrengthPa`. All of these values are representative and
chosen empirically, with no fixed source; the glass tensile strength (10 MPa)
is the effective strength of a flawed sheet, lower than the 40 MPa of a
pristine one, and was chosen so the existing glass drops and throws still
break. A crack starts only where the tensile stress a contact induces reaches
the tensile strength.

| Preset      | E (GPa) | f_t (MPa) |
| ----------- | ------: | --------: |
| Glass       |      70 |        10 |
| Ice (−13°C) |       9 |       1.5 |
| PMMA        |       3 |        70 |
| Polystyrene |     3.3 |        45 |
| Concrete    |      30 |         3 |
| Wood        |      10 |        40 |
| Steel       |     200 |       400 |
| Rubber      |    0.01 |        15 |
| EPS foam    |   0.005 |       0.2 |

The estimate is `σ = Kt × F / (t × w)`. `F = (J / 2) × sqrt(k / m*)` is the peak
load of a half-sine pulse of the step's normal impulse `J` on the body's contact
spring `k = E t w / h` (the far side taken as rigid) with effective mass `m*`,
`w` is the contact patch width, `t` the thickness and `h` the smaller of the body
depth and `w`. The stress concentration `Kt` runs from 6 for a patch as wide as
the body to 60 for a point contact (the patch is never narrower than 1% of the
body width); both are empirical, fitted against the glass tests. The energy that
can go into cracks is the lost energy, less the work the bulk of the body
dissipates, capped by `σ² / (2E)` times the loaded volume `t × w × h`, so the
crack length of one hit never exceeds `U / (Gc × t)`.

Steel and solid polystyrene set a bulk dissipation of 7 J/kg (chosen
empirically against the drop tests, no fixed source; every other preset has
none): `7 J/kg × mass` is subtracted from the lost energy of each contact
before the crack budget. The stress-derived cap alone rarely binds (it equals
`Kt² × J² / (8 m*)`, and even capped at the spring energy `J² / (8 m*)` the
split counts below stay the same), so the bulk work is what stops a tough plate
that carries a lot of lost energy from splitting.

A material that sets a flaw length `a0` also needs the Griffith stress
`sqrt(2 E Gc / (π a0))`, with `a0` the total flaw length: doubling `a0` divides
that stress by √2, and a flaw four times as long halves it. No preset sets one.

Measured with the real Rapier world, a 0.5 × 0.5 m plate dropped from 1 m onto
a concrete floor: 180 mm solid polystyrene stays whole in a flat drop (also from
0.3 m) and when tilted by 1°, 5°, 10° or 15°, glass at 10 mm still breaks (4
bodies flat, 3 tilted by 10°), the polystyrene plate dropped on a corner (45°)
splits into 4 bodies, and a 10 mm mild steel plate dropped flat stays whole.
From 2 m the tilted polystyrene plates and the steel plate split again; with no
bulk dissipation the 1 m drops of those three split as before (4 to 5 bodies
for polystyrene tilted by 10° or more, 3 for steel).

Limits of the model: thickness does not change whether a flat drop starts a
crack, because the stress scales with sqrt(E / (m t)) and the mass grows with
the thickness too; the polystyrene plate stays whole because of its tensile
strength, not its thickness. The far side of a contact (floor or ball) is taken
as rigid, so its softness acts only through the impulse it returns. The
bulk dissipation is a per-mass constant, not derived from the plate's yield or
deformed volume.

Expanded polystyrene (20 kg/m³) is a crushing material: it never cracks. The
body keeps one permanent compression `p` per 0.05 m cell of its own coordinates.
A hit that exceeds what the cell takes elastically raises `p` along the plateau
stress (100 kPa) and, past the densification point, the hardening (modulus
20 MPa); the work spent is the lost energy of the body's contact. A crushed cell
re-loads with a modulus that rises from E towards the densified modulus, so a
second hit on the same spot is stiffer than one on a fresh spot. The rigid
motion is not changed by the crushing: the stored compression and stiffness
describe the foam, not the bounce. The foam depth one contact loads is at most
20 mm.

[mit]: https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/e5bca953e1dbd0cd0376f0f77033dc0d_MIT3_11F99_frac.pdf#page=9
[ice]: https://www.cambridge.org/core/journals/journal-of-glaciology/article/fracture-toughness-of-ice-a-preliminary-account-of-some-new-experiments/87E062E1284661430F7346A643015532
