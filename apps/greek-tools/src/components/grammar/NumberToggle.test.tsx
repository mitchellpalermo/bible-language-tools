import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NumberToggle from './NumberToggle';

describe('NumberToggle', () => {
  it('renders Sg and Pl buttons', () => {
    render(<NumberToggle activeNumber="sg" onToggle={() => {}} />);
    expect(screen.getByText('Sg')).toBeInTheDocument();
    expect(screen.getByText('Pl')).toBeInTheDocument();
  });

  it('marks the active number as pressed', () => {
    render(<NumberToggle activeNumber="pl" onToggle={() => {}} />);
    expect(screen.getByText('Pl')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Sg')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onToggle with the tapped number', () => {
    const onToggle = vi.fn();
    render(<NumberToggle activeNumber="sg" onToggle={onToggle} />);
    fireEvent.click(screen.getByText('Pl'));
    expect(onToggle).toHaveBeenCalledWith('pl');
  });

  it('has md:hidden class so it only shows on mobile', () => {
    const { container } = render(<NumberToggle activeNumber="sg" onToggle={() => {}} />);
    expect(container.firstChild).toHaveClass('md:hidden');
  });
});
