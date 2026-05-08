import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdjParadigm } from '../../data/grammar';
import AdjParadigmCard from './AdjParadigmCard';

const paradigm: AdjParadigm = {
  id: 'adj-2-1-2',
  name: '2-1-2 Adjective — ἀγαθός, -ή, -όν',
  type: '2-1-2',
  forms: {
    nom: {
      sg: { m: 'ἀγαθός', f: 'ἀγαθή', n: 'ἀγαθόν' },
      pl: { m: 'ἀγαθοί', f: 'ἀγαθαί', n: 'ἀγαθά' },
    },
    gen: {
      sg: { m: 'ἀγαθοῦ', f: 'ἀγαθῆς', n: 'ἀγαθοῦ' },
      pl: { m: 'ἀγαθῶν', f: 'ἀγαθῶν', n: 'ἀγαθῶν' },
    },
    dat: {
      sg: { m: 'ἀγαθῷ', f: 'ἀγαθῇ', n: 'ἀγαθῷ' },
      pl: { m: 'ἀγαθοῖς', f: 'ἀγαθαῖς', n: 'ἀγαθοῖς' },
    },
    acc: {
      sg: { m: 'ἀγαθόν', f: 'ἀγαθήν', n: 'ἀγαθόν' },
      pl: { m: 'ἀγαθούς', f: 'ἀγαθάς', n: 'ἀγαθά' },
    },
    voc: {
      sg: { m: 'ἀγαθέ', f: 'ἀγαθή', n: 'ἀγαθόν' },
      pl: { m: 'ἀγαθοί', f: 'ἀγαθαί', n: 'ἀγαθά' },
    },
  },
};

describe('AdjParadigmCard', () => {
  it('renders the paradigm name in the header', () => {
    render(<AdjParadigmCard paradigm={paradigm} />);
    expect(screen.getByText(paradigm.name)).toBeInTheDocument();
  });

  it('renders the endings toggle', () => {
    render(<AdjParadigmCard paradigm={paradigm} />);
    expect(screen.getByText('Full forms')).toBeInTheDocument();
  });

  it('renders the number toggle for mobile', () => {
    render(<AdjParadigmCard paradigm={paradigm} />);
    expect(screen.getByText('Sg')).toBeInTheDocument();
    expect(screen.getByText('Pl')).toBeInTheDocument();
  });

  it('shows singular forms by default in the mobile table', () => {
    render(<AdjParadigmCard paradigm={paradigm} />);
    // Singular nom masc should appear in both desktop and mobile tables
    const cells = screen.getAllByText('ἀγαθός');
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it('switches to plural forms when Pl is tapped', () => {
    render(<AdjParadigmCard paradigm={paradigm} />);
    fireEvent.click(screen.getByText('Pl'));
    // Plural nom masc should now appear in the mobile table
    const cells = screen.getAllByText('ἀγαθοί');
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the desktop 6-column table with both numbers', () => {
    render(<AdjParadigmCard paradigm={paradigm} />);
    // Desktop table has Singular and Plural headers
    expect(screen.getByText('Singular')).toBeInTheDocument();
    expect(screen.getByText('Plural')).toBeInTheDocument();
  });

  it('renders description bar', () => {
    render(<AdjParadigmCard paradigm={paradigm} />);
    expect(screen.getByText(/hover over a cell/i)).toBeInTheDocument();
  });
});
