# Diner motion notes

Method: [rossark-motion-skill](https://github.com/rossark0/rossark-motion-skill). Engine: `motion.ts` (web port of its `motion.ts`). Choreography: `useDog.ts`. Every timing and distance is in the `T` object at the top of `useDog.ts`.

## Rules for this scene

- **One main action:** the dachshund's errand (fetch, type, sit). Idle loops: breathing while asleep, steam, the car and bird outside, radio notes. Nothing else moves.
- **Same scale in every pose.** Each pose is drawn at `--k` px per viewBox unit (`ART_W` in `useDog.ts`), anchored at the dog's bottom centre, so swapping poses never changes size or position. New poses must declare their viewBox width in `ART_W`.
- **Never teleport.** The rig (x, lift, scale, facing, door, paper) is interpolated every frame. Poses cross-fade for 220 ms; turning animates `scaleX` through 0.
- **Walks flow.** Paths use `flow()` so the dog doesn't stop at intermediate points (through the doorway, into the room). Speed is constant (190 px/s), easing only at the ends.
- **Depth = lift + scale.** The door sill sits at the floor line, so walking to the door raises the dog 40 px and shrinks it to 0.8. The jamb right of the doorway (`.door-jamb-front`) is drawn above the dog, so it walks *through* the door instead of off the screen.
- **Door:** opens just before the dog reaches the sill and closes about 380 ms after it's through. Swing is ease-in-out over 600 ms.
- **Anticipation:** a play-bow stretch before getting up. Hop onto the counter at its edge, then trot along it.
- **Breathing** only rises (scaleY 1.03 from the floor). Width never changes.
- **Reduced motion:** every sequence jumps to its final pose.
- **Positions are measured** from the scene (door, table, counter), never hard-coded, so it works at every width.

## Preview

Append `?diner=out|done|failed|apply|rank` to the URL to play a fake run.
