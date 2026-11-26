import { describe, expect, it } from 'vitest';
import { calculateDropPosition } from '@/lib/fractionalIndex';

describe('calculateDropPosition', () => {
  it('returns 1000 when list is empty', () => {
    expect(calculateDropPosition([], 0)).toBe(1000);
  });

  it('returns half of first position when inserting at the top', () => {
    const items = [{ position: 1000 }, { position: 2000 }];
    expect(calculateDropPosition(items, 0)).toBe(500);
    expect(calculateDropPosition(items, -1)).toBe(500);
  });

  it('returns last position plus 1000 when inserting at the bottom', () => {
    const items = [{ position: 1000 }, { position: 2000 }];
    expect(calculateDropPosition(items, 2)).toBe(3000);
    expect(calculateDropPosition(items, 10)).toBe(3000);
  });

  it('returns midpoint between neighbors when inserting in the middle', () => {
    const items = [{ position: 1000 }, { position: 2000 }];
    expect(calculateDropPosition(items, 1)).toBe(1500);
  });
});
