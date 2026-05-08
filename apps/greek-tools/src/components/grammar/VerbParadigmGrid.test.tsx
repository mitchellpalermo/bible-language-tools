import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { verbParadigms } from '../../data/grammar';
import VerbParadigmGrid from './VerbParadigmGrid';

const defaultProps = {
  paradigms: verbParadigms,
  selectedId: 'pres-act-ind',
  onSelect: vi.fn(),
  activeMood: 'indicative' as const,
  onMoodChange: vi.fn(),
};

describe('VerbParadigmGrid', () => {
  // ─── Mood tabs ────────────────────────────────────────────────────────────

  it('renders mood tabs', () => {
    render(<VerbParadigmGrid {...defaultProps} />);
    expect(screen.getByText('Indicative')).toBeInTheDocument();
    expect(screen.getByText('Subjunctive')).toBeInTheDocument();
    expect(screen.getByText('Imperative')).toBeInTheDocument();
  });

  it('calls onMoodChange when a mood tab is clicked', () => {
    const onMoodChange = vi.fn();
    render(<VerbParadigmGrid {...defaultProps} onMoodChange={onMoodChange} />);
    fireEvent.click(screen.getByText('Subjunctive'));
    expect(onMoodChange).toHaveBeenCalledWith('subjunctive');
  });

  // ─── Indicative grid ─────────────────────────────────────────────────────

  it('renders tense row labels for indicative', () => {
    render(<VerbParadigmGrid {...defaultProps} />);
    expect(screen.getByText('Pres')).toBeInTheDocument();
    expect(screen.getByText('Impf')).toBeInTheDocument();
    expect(screen.getByText('Fut')).toBeInTheDocument();
    expect(screen.getByText('Aor')).toBeInTheDocument();
    expect(screen.getByText('Perf')).toBeInTheDocument();
  });

  it('renders voice column headers for indicative', () => {
    render(<VerbParadigmGrid {...defaultProps} />);
    expect(screen.getByText('Act')).toBeInTheDocument();
    expect(screen.getByText('Mid')).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
  });

  it('calls onSelect with the paradigm id when a cell is clicked', () => {
    const onSelect = vi.fn();
    render(<VerbParadigmGrid {...defaultProps} onSelect={onSelect} />);
    // Click the cell with title "Aorist Passive Indicative"
    fireEvent.click(screen.getByTitle('Aorist Passive Indicative'));
    expect(onSelect).toHaveBeenCalledWith('aor-pass-ind');
  });

  it('renders M/P label for combined Middle/Passive cells', () => {
    render(<VerbParadigmGrid {...defaultProps} />);
    // Present and Imperfect Mid/Pass should show "M/P"
    const mpCells = screen.getAllByText('M/P');
    expect(mpCells.length).toBeGreaterThanOrEqual(2); // Present M/P + Imperfect M/P
  });

  it('renders empty dash cells for non-existent paradigms', () => {
    render(<VerbParadigmGrid {...defaultProps} />);
    // Perfect only has Active, so Mid and Pass should be dashes
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Subjunctive grid ────────────────────────────────────────────────────

  it('renders only Present and Aorist for subjunctive', () => {
    render(
      <VerbParadigmGrid {...defaultProps} activeMood="subjunctive" selectedId="pres-act-subj" />,
    );
    expect(screen.getByText('Pres')).toBeInTheDocument();
    expect(screen.getByText('Aor')).toBeInTheDocument();
    expect(screen.queryByText('Impf')).not.toBeInTheDocument();
    expect(screen.queryByText('Fut')).not.toBeInTheDocument();
  });

  it('renders Act and Pass columns for subjunctive (no Mid)', () => {
    render(
      <VerbParadigmGrid {...defaultProps} activeMood="subjunctive" selectedId="pres-act-subj" />,
    );
    expect(screen.getByText('Act')).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.queryByText('Mid')).not.toBeInTheDocument();
  });

  // ─── Imperative grid ─────────────────────────────────────────────────────

  it('renders Present and Aorist for imperative', () => {
    render(
      <VerbParadigmGrid {...defaultProps} activeMood="imperative" selectedId="pres-act-imp" />,
    );
    expect(screen.getByText('Pres')).toBeInTheDocument();
    expect(screen.getByText('Aor')).toBeInTheDocument();
  });

  // ─── Form preview mode ───────────────────────────────────────────────────

  it('shows 1sg form when showFormPreview is true', () => {
    render(<VerbParadigmGrid {...defaultProps} showFormPreview />);
    // Present Active Indicative 1sg = λύω
    expect(screen.getByText('λύω')).toBeInTheDocument();
  });

  it('shows dots/labels when showFormPreview is false', () => {
    render(<VerbParadigmGrid {...defaultProps} showFormPreview={false} />);
    // Should have dot indicators for non-M/P cells
    const dots = screen.getAllByText('●');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Selection state ──────────────────────────────────────────────────────

  it('highlights the selected cell', () => {
    render(<VerbParadigmGrid {...defaultProps} selectedId="aor-act-ind" />);
    const cell = screen.getByTitle('Aorist Active Indicative');
    expect(cell.style.background).toContain('var(--color-primary)');
  });
});
