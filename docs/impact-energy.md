# Impact energy and support forces

A resting object has a nonzero contact impulse: the floor must balance gravity.
Squaring that impulse treats the support reaction as a new impact every step.
The fracture rule instead measures lost kinetic energy in the contact-normal
mode. It leaves sensor amplitudes, wake behavior and material values unchanged.

## Discrete contact calculation

For each body, save COM linear velocity `v` and angular velocity `w` before the
Rapier step. Read its velocities again after the step. At the impulse-weighted
contact position, let `r` be the lever from COM and `n` the unit normal from body
A to B. Rapier's manifold `flipped` flag determines the normal orientation.

The normal contact velocity and inverse effective mass are:

```text
s = v · n + w (r × n)
k = 1/m + (r × n)² / I
```

Fixed bodies have `k = 0`. Using the same contact geometry for both velocity
samples, let `u = sA_before - sB_before` be the approaching speed and
`q = sB_after - sA_after` the final relative normal speed. If `u <= 0` or
`kA + kB <= 0`, the budget is zero. Otherwise:

```text
E = max(0, (u² - q²) / (2 (kA + kB)))
EA = E kA / (kA + kB)
EB = E kB / (kA + kB)
```

This is the kinetic-energy loss of an isolated scalar normal mode with its
geometry held fixed during the step. An inelastic 2 kg body hitting a fixed
wall at 3 m/s gives 9 J. A perfectly elastic normal rebound gives zero loss.
A stationary supported body gives zero despite its gravity-balancing impulse.
The two shares sum to the contact budget; unbreakable bodies do not donate
their share to the other body.

The fracture geometry uses each body's share with `Gc × thickness`, retaining
its post-impact rigid velocity field. Crack geometry still respects the minimum
fragment area, per-hit piece limit and body cap.

## Scope and limits

This remains a rigid-body damage approximation. The inverse-effective-mass
split is a modeling choice, not a calculation of each material's elastic strain
energy. Contacts use a representative weighted point and the same discrete
geometry before and after solving. External work within a step, coupled
simultaneous contacts, tangential damage, static stress failure and crack-tip
stress fields are not resolved. Per-contact accounting does not prove a global
energy balance for coupled contact networks, and the model is not calibrated to
predict actual glass fracture patterns or fracture loads.

The formulas use contact relative velocity and effective mass from
[Erin Catto, Modeling and Solving Constraints, GDC 2009][catto]. Its virtual-work
section explains why ideal stationary constraint forces do no work. The
[Rapier force and impulse guide][rapier] distinguishes acceleration from impulse
velocity change. Neither source defines this simulation's fracture allocation;
that approximation is stated above.

[catto]: https://box2d.org/files/ErinCatto_ModelingAndSolvingConstraints_GDC2009.pdf
[rapier]: https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/
