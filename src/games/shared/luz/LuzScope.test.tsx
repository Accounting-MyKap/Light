import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFeedback, useFeedbackSignal } from '../feedback';
import { LuzScope } from './LuzScope';

const ORIGINAL_COLOR = '#0E0F1A';

function themeColor(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
}

beforeEach(() => {
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = ORIGINAL_COLOR;
  document.head.appendChild(meta);
});

afterEach(() => {
  document.querySelector('meta[name="theme-color"]')?.remove();
  document.documentElement.removeAttribute('data-luz-active');
});

test('marks the page and darkens the browser bar while mounted, then restores them', () => {
  const { unmount, container } = render(
    <LuzScope area="attention">
      <p>x</p>
    </LuzScope>,
  );
  expect(container.querySelector('[data-luz][data-area="attention"]')).not.toBeNull();
  expect(document.documentElement.hasAttribute('data-luz-active')).toBe(true);
  expect(themeColor()).toBe('#090b19');
  unmount();
  expect(document.documentElement.hasAttribute('data-luz-active')).toBe(false);
  expect(themeColor()).toBe(ORIGINAL_COLOR);
});

test('a double mount (StrictMode) and two scopes in a row still restore the original color', () => {
  const { rerender, unmount } = render(
    <StrictMode>
      <LuzScope area="memory">
        <p>x</p>
      </LuzScope>
    </StrictMode>,
  );
  // StrictMode ran mount, cleanup, mount: the page must still be dark while the scope is mounted.
  expect(document.documentElement.hasAttribute('data-luz-active')).toBe(true);
  expect(themeColor()).toBe('#090b19');

  rerender(
    <StrictMode>
      <LuzScope area="math">
        <p>x</p>
      </LuzScope>
    </StrictMode>,
  );
  expect(themeColor()).toBe('#090b19');
  unmount();
  expect(document.documentElement.hasAttribute('data-luz-active')).toBe(false);
  expect(themeColor()).toBe(ORIGINAL_COLOR);

  const second = render(
    <LuzScope area="speed">
      <p>x</p>
    </LuzScope>,
  );
  expect(themeColor()).toBe('#090b19');
  second.unmount();
  expect(document.documentElement.hasAttribute('data-luz-active')).toBe(false);
  expect(themeColor()).toBe(ORIGINAL_COLOR);
});

test('works without a theme-color meta and does not leave one behind', () => {
  document.querySelector('meta[name="theme-color"]')?.remove();
  const { unmount } = render(
    <LuzScope area="flexibility">
      <p>x</p>
    </LuzScope>,
  );
  expect(document.documentElement.hasAttribute('data-luz-active')).toBe(true);
  expect(() => unmount()).not.toThrow();
  expect(document.documentElement.hasAttribute('data-luz-active')).toBe(false);
  expect(document.querySelector('meta[name="theme-color"]')).toBeNull();
});

test('answers inside the scope publish their reaction signal', async () => {
  function Game() {
    const feedback = useFeedback();
    const signal = useFeedbackSignal();
    return (
      <>
        <button onClick={() => feedback('wrong')}>answer</button>
        <p data-testid="signal">{signal ? `${signal.kind}#${signal.id}` : 'none'}</p>
      </>
    );
  }
  render(
    <LuzScope area="memory">
      <Game />
    </LuzScope>,
  );
  expect(screen.getByTestId('signal')).toHaveTextContent('none');
  await userEvent.click(screen.getByRole('button', { name: 'answer' }));
  expect(screen.getByTestId('signal')).toHaveTextContent('wrong#1');
});
