// Each flatmate gets one pale tint with the dark of the same hue as ink, picked by the order they
// joined the home. Neighbours in the list sit at least 60 degrees apart on the colour wheel, so
// Asha and Ben never look alike. These tints are identity, not data: money stays in ink.

export type Tint = { bg: string; ink: string }

const TINTS: readonly Tint[] = [
  { bg: '#dcebff', ink: '#0a3a80' }, // blue, 212°
  { bg: '#fdebd0', ink: '#7a4206' }, // amber, 36°
  { bg: '#d4f1ec', ink: '#0b524a' }, // teal, 172°
  { bg: '#fde1e3', ink: '#8a1c2b' }, // rose, 352°
  { bg: '#ebefcf', ink: '#4a5210' }, // olive, 68°
  { bg: '#e9ebee', ink: '#3a3d40' }, // grey
]

const FALLBACK: Tint = { bg: '#e9ebee', ink: '#3a3d40' }

export function tintFor(index: number): Tint {
  return TINTS[index % TINTS.length] ?? FALLBACK
}

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}
