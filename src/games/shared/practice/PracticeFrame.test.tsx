import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initI18n } from '../../../i18n';
import { FeedbackProvider } from '../feedback';
import { PracticeFrame } from './PracticeFrame';

vi.mock('../../../core/sound');

function renderFrame(props: Partial<React.ComponentProps<typeof PracticeFrame>> = {}) {
  return render(
    <FeedbackProvider>
      <PracticeFrame
        round={2}
        total={4}
        message="Mira el centro"
        title="Flechas"
        onSkip={() => undefined}
        controls={<button>Sí</button>}
        {...props}
      >
        <p>Escena</p>
      </PracticeFrame>
    </FeedbackProvider>,
  );
}

beforeEach(async () => {
  await initI18n('es');
});

test('shows the progress', () => {
  renderFrame();
  expect(screen.getByText('Práctica 2 de 4')).toBeInTheDocument();
});

test('the skip button calls onSkip', async () => {
  const onSkip = vi.fn();
  renderFrame({ onSkip });
  await userEvent.click(screen.getByRole('button', { name: 'Saltar práctica' }));
  expect(onSkip).toHaveBeenCalledTimes(1);
});

test('the message lives in a polite live region with its tone', () => {
  const { rerender } = renderFrame({ tone: 'hint' });
  const bubble = screen.getByText('Mira el centro');
  expect(bubble).toHaveAttribute('aria-live', 'polite');
  expect(bubble).toHaveAttribute('data-tone', 'hint');
  rerender(
    <FeedbackProvider>
      <PracticeFrame round={2} total={4} message="Mira el centro" title="Flechas" tone="ok" onSkip={() => undefined}>
        <p>Escena</p>
      </PracticeFrame>
    </FeedbackProvider>,
  );
  expect(screen.getByText('Mira el centro')).toHaveAttribute('data-tone', 'ok');
});

test('has a stage and a controls zone', () => {
  const { container } = renderFrame();
  expect(container.querySelector('[data-zone="stage"]')).toHaveTextContent('Escena');
  expect(container.querySelector('[data-zone="controls"]')).toHaveTextContent('Sí');
});

test('the tone is normal by default', () => {
  renderFrame();
  expect(screen.getByText('Mira el centro')).toHaveAttribute('data-tone', 'normal');
});

test('has a heading with the game title and takes the focus on mount', () => {
  const { container } = renderFrame();
  expect(screen.getByRole('heading', { level: 1, name: 'Flechas' })).toBeInTheDocument();
  expect(container.firstElementChild).toHaveFocus();
});

test('leaves the focus alone when it is already inside', () => {
  render(
    <FeedbackProvider>
      <PracticeFrame round={1} total={4} message="m" title="Flechas" onSkip={() => undefined}>
        <input aria-label="dentro" autoFocus />
      </PracticeFrame>
    </FeedbackProvider>,
  );
  expect(screen.getByLabelText('dentro')).toHaveFocus();
});
