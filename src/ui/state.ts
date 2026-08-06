/**
 * UI state via alien-signals.
 *
 * Scope note: signals are used *only* for state that changes on interaction —
 * filters, selection, the active arm. The particle simulation deliberately does
 * not go through here. Signals exist to skip work when nothing changed; a
 * per-frame simulation changes everything every frame, so routing it through a
 * dependency graph would add bookkeeping and remove nothing. `effectRuns` below
 * exists to prove that claim at runtime rather than assert it.
 */

import { signal, computed, effect } from 'alien-signals';
import { SPECIES_COUNT, SPECIES_NAMES } from '../sim/world';

/** Bitmask of enabled species; all on by default. */
export const speciesMask = signal((1 << SPECIES_COUNT) - 1);
export const selectedEid = signal(-1);
export const arm = signal<'gpu' | 'baseline'>('gpu');
export const entityCount = signal(0);

export const activeSpecies = computed(() => {
  const m = speciesMask();
  const out: number[] = [];
  for (let i = 0; i < SPECIES_COUNT; i++) if (m & (1 << i)) out.push(i);
  return out;
});

export const filterLabel = computed(() => {
  const a = activeSpecies();
  if (a.length === SPECIES_COUNT) return 'all species';
  if (a.length === 0) return 'none';
  return a.map((i) => SPECIES_NAMES[i]).join(', ');
});

export function toggleSpecies(i: number) {
  speciesMask(speciesMask() ^ (1 << i));
}

/**
 * Instrumentation for the claim above: counts how many times the reactive graph
 * actually ran an effect. Shown in the HUD next to the frame counter — if the
 * demo is honest, this stays flat while frames climb.
 */
let runs = 0;
export const effectRuns = () => runs;
export function countEffect(fn: () => void) {
  return effect(() => {
    runs++;
    fn();
  });
}
