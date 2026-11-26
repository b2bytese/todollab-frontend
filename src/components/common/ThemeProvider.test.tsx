import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeProvider';

function createMatchMediaController(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    addListener: vi.fn((cb: (event: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    }),
    removeListener: vi.fn((cb: (event: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    }),
    addEventListener: vi.fn((event: string, cb: EventListenerOrEventListenerObject) => {
      if (event === 'change' && typeof cb === 'function') {
        listeners.add(cb as (event: MediaQueryListEvent) => void);
      }
    }),
    removeEventListener: vi.fn((event: string, cb: EventListenerOrEventListenerObject) => {
      if (event === 'change' && typeof cb === 'function') {
        listeners.delete(cb as (event: MediaQueryListEvent) => void);
      }
    }),
    dispatchEvent: vi.fn(() => true),
  }));

  return {
    matchMedia,
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = {
        matches: nextMatches,
        media: '(prefers-color-scheme: dark)',
      } as MediaQueryListEvent;
      listeners.forEach((cb) => cb(event));
    },
  };
}

function ThemeConsumer() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <button type="button" onClick={() => setTheme('dark')}>
        Escuro
      </button>
      <button type="button" onClick={() => setTheme('light')}>
        Claro
      </button>
      <button type="button" onClick={() => setTheme('system')}>
        Sistema
      </button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('toggles .dark on documentElement and persists todollab-theme in localStorage', async () => {
    const controller = createMatchMediaController(false);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: controller.matchMedia,
    });

    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Escuro' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('todollab-theme')).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Claro' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('todollab-theme')).toBe('light');
  });

  it('respects system media query initially and updates when prefers-color-scheme changes', async () => {
    const controller = createMatchMediaController(true);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: controller.matchMedia,
    });

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      controller.setMatches(false);
    });

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('hydrates persisted theme from localStorage on mount', () => {
    localStorage.setItem('todollab-theme', 'dark');
    const controller = createMatchMediaController(false);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: controller.matchMedia,
    });

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('throws when useTheme is called outside ThemeProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ThemeConsumer />)).toThrow(
      /useTheme must be used within a ThemeProvider/,
    );
    spy.mockRestore();
  });
});
