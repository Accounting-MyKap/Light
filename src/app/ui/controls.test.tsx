import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from './SegmentedControl';
import { Switch } from './Switch';

describe('Switch', () => {
  test('is a checked switch named by its label and reports changes', async () => {
    const onChange = vi.fn();
    render(<Switch id="sound" label="Sonido" checked onChange={onChange} />);
    const toggle = screen.getByRole('switch', { name: 'Sonido' });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test('the hint describes the switch without changing its name', () => {
    render(<Switch id="vib" label="Sonido" checked onChange={() => {}} hint="Solo en teléfonos" />);
    const toggle = screen.getByRole('switch', { name: 'Sonido' });
    expect(toggle).toHaveAccessibleDescription('Solo en teléfonos');
    expect(toggle).toHaveAccessibleName('Sonido');
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'auto', label: 'Automático' },
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
  ] as const;

  test('is a group of radios with the current value checked', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl name="theme" legend="Tema" options={options} value="light" onChange={onChange} />);
    const group = screen.getByRole('group', { name: 'Tema' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Claro' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Oscuro' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  test('arrow keys move between the radios', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl name="theme" legend="Tema" options={options} value="auto" onChange={onChange} />);
    screen.getByRole('radio', { name: 'Automático' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('light');
  });
});
