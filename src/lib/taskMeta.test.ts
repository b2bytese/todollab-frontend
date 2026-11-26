import { describe, expect, it } from 'vitest';
import {
  getPriorityMeta,
  getRoleLabel,
  PRIORITY_META,
  ROLE_LABELS,
} from '@/lib/taskMeta';

describe('taskMeta helpers', () => {
  it('returns metadata for known priorities and safe fallback for unknown values', () => {
    expect(PRIORITY_META.URGENT).toEqual({ label: 'Urgente', variant: 'coral' });
    expect(getPriorityMeta('HIGH')).toEqual({ label: 'Alta', variant: 'warning' });
    expect(getPriorityMeta('CUSTOM')).toEqual({
      label: 'CUSTOM',
      variant: 'secondary',
    });
    expect(getPriorityMeta('toString')).toEqual({
      label: 'toString',
      variant: 'secondary',
    });
  });

  it('returns labels for known board roles and safe fallback for unknown values', () => {
    expect(ROLE_LABELS).toEqual({
      OWNER: 'Proprietário',
      EDITOR: 'Editor',
      VIEWER: 'Visualizador',
    });
    expect(getRoleLabel('EDITOR')).toBe('Editor');
    expect(getRoleLabel('GUEST')).toBe('GUEST');
    expect(getRoleLabel('constructor')).toBe('constructor');
  });
});
