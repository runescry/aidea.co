const DOT_CLASSES = ['bg-child-1', 'bg-child-2', 'bg-child-3', 'bg-child-4'];
const TEXT_CLASSES = ['text-child-1', 'text-child-2', 'text-child-3', 'text-child-4'];
const BORDER_CLASSES = ['border-child-1', 'border-child-2', 'border-child-3', 'border-child-4'];
const RING_CLASSES = ['ring-child-1', 'ring-child-2', 'ring-child-3', 'ring-child-4'];

export function childDotClass(colorIndex: number): string {
  return DOT_CLASSES[colorIndex % DOT_CLASSES.length]!;
}

export function childTextClass(colorIndex: number): string {
  return TEXT_CLASSES[colorIndex % TEXT_CLASSES.length]!;
}

export function childBorderClass(colorIndex: number): string {
  return BORDER_CLASSES[colorIndex % BORDER_CLASSES.length]!;
}

export function childRingClass(colorIndex: number): string {
  return RING_CLASSES[colorIndex % RING_CLASSES.length]!;
}
