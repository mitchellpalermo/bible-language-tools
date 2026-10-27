import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ToggleSwitch, { KNOB_TRAVEL, trackColor } from './ToggleSwitch';

const ACCENT = 'var(--color-grape, #7C3AED)';

function renderSwitch(props: Partial<Parameters<typeof ToggleSwitch>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <ToggleSwitch
      checked={false}
      onChange={onChange}
      label="Part of speech"
      accent={ACCENT}
      {...props}
    />,
  );
  return { onChange, control: screen.getByRole('switch') };
}

describe('ToggleSwitch', () => {
  it('exposes itself as a switch named by its label', () => {
    const { control } = renderSwitch();
    expect(screen.getByRole('switch', { name: 'Part of speech' })).toBe(control);
  });

  it('reports its state through aria-checked, not aria-pressed', () => {
    // A switch is on or off; a pressed button is a momentary action. Screen
    // readers announce the two differently, and this control is the former.
    const { control } = renderSwitch({ checked: true });
    expect(control.getAttribute('aria-checked')).toBe('true');
    expect(control.getAttribute('aria-pressed')).toBeNull();
  });

  it('reports the off state too', () => {
    const { control } = renderSwitch({ checked: false });
    expect(control.getAttribute('aria-checked')).toBe('false');
  });

  it('calls onChange when clicked', async () => {
    const user = userEvent.setup();
    const { onChange, control } = renderSwitch();
    await user.click(control);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('is operable from the keyboard', async () => {
    const user = userEvent.setup();
    const { onChange, control } = renderSwitch();
    control.focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('is a type="button", so it cannot submit a surrounding form', () => {
    const { control } = renderSwitch();
    expect(control.getAttribute('type')).toBe('button');
  });

  it("puts the app's accent on the track only while on", () => {
    expect(trackColor(true, ACCENT)).toBe(ACCENT);
    expect(trackColor(false, ACCENT)).not.toBe(ACCENT);
  });

  it('slides the knob across when on, and not when off', () => {
    // This is what makes it read as a switch rather than a two-state button,
    // and unlike the colour it survives happy-dom's CSS parser.
    const knobTransform = (checked: boolean) => {
      const { unmount } = render(
        <ToggleSwitch checked={checked} onChange={() => {}} label="x" accent={ACCENT} />,
      );
      const knob = screen
        .getByRole('switch')
        .querySelector('[aria-hidden="true"] > span') as HTMLElement;
      const transform = knob.style.transform;
      unmount();
      return transform;
    };
    expect(knobTransform(true)).toBe(`translateX(${KNOB_TRAVEL}px)`);
    expect(knobTransform(false)).toBe('translateX(0)');
  });

  it('does not expose the track to assistive tech', () => {
    // The button already carries the role, the state and the name; a second
    // announcement of the same thing is noise.
    const { control } = renderSwitch();
    expect(control.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('passes a title through for the hover explanation', () => {
    const { control } = renderSwitch({ title: 'Shown with the answer either way.' });
    expect(control.getAttribute('title')).toBe('Shown with the answer either way.');
  });
});
