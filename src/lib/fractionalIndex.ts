/**
 * Computes the fractional position for an item dropped at `targetIndex`
 * inside a sorted list that excludes the dragged item itself.
 */
export function calculateDropPosition(
  orderedItems: readonly { position: number }[],
  targetIndex: number,
): number {
  if (orderedItems.length === 0) {
    return 1000;
  }
  if (targetIndex <= 0) {
    return orderedItems[0].position / 2;
  }
  if (targetIndex >= orderedItems.length) {
    return orderedItems[orderedItems.length - 1].position + 1000;
  }
  return (
    (orderedItems[targetIndex - 1].position +
      orderedItems[targetIndex].position) /
    2
  );
}
