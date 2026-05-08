import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GenderedPronoun } from '../../data/grammar';
import GenderedPronounCard from './GenderedPronounCard';

const pronoun: GenderedPronoun = {
  id: 'autos',
  name: 'αὐτός — 3rd Person / Intensive',
  kind: '3rd-personal',
  forms: {
    nom: { sg: { m: 'αὐτός', f: 'αὐτή', n: 'αὐτό' }, pl: { m: 'αὐτοί', f: 'αὐταί', n: 'αὐτά' } },
    gen: { sg: { m: 'αὐτοῦ', f: 'αὐτῆς', n: 'αὐτοῦ' }, pl: { m: 'αὐτῶν', f: 'αὐτῶν', n: 'αὐτῶν' } },
    dat: { sg: { m: 'αὐτῷ', f: 'αὐτῇ', n: 'αὐτῷ' }, pl: { m: 'αὐτοῖς', f: 'αὐταῖς', n: 'αὐτοῖς' } },
    acc: { sg: { m: 'αὐτόν', f: 'αὐτήν', n: 'αὐτό' }, pl: { m: 'αὐτούς', f: 'αὐτάς', n: 'αὐτά' } },
  },
};

describe('GenderedPronounCard', () => {
  it('renders the pronoun name in the header', () => {
    render(<GenderedPronounCard pronoun={pronoun} />);
    expect(screen.getByText(pronoun.name)).toBeInTheDocument();
  });

  it('renders the number toggle for mobile', () => {
    render(<GenderedPronounCard pronoun={pronoun} />);
    expect(screen.getByText('Sg')).toBeInTheDocument();
    expect(screen.getByText('Pl')).toBeInTheDocument();
  });

  it('shows singular forms by default', () => {
    render(<GenderedPronounCard pronoun={pronoun} />);
    const cells = screen.getAllByText('αὐτός');
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it('switches to plural forms when Pl is tapped', () => {
    render(<GenderedPronounCard pronoun={pronoun} />);
    fireEvent.click(screen.getByText('Pl'));
    const cells = screen.getAllByText('αὐτοί');
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it('renders desktop table with Singular and Plural headers', () => {
    render(<GenderedPronounCard pronoun={pronoun} />);
    expect(screen.getByText('Singular')).toBeInTheDocument();
    expect(screen.getByText('Plural')).toBeInTheDocument();
  });

  it('renders dash for missing forms', () => {
    const partial: GenderedPronoun = {
      id: 'test',
      name: 'Test Pronoun',
      kind: 'relative',
      forms: {
        nom: { sg: { m: 'ός', f: 'ή', n: 'ό' }, pl: { m: 'οί', f: 'αί', n: 'ά' } },
        // gen, dat, acc missing
      },
    };
    render(<GenderedPronounCard pronoun={partial} />);
    // Only NOM row should render, no GEN/DAT/ACC rows
    expect(screen.queryByText('GEN')).not.toBeInTheDocument();
  });

  it('renders description bar', () => {
    render(<GenderedPronounCard pronoun={pronoun} />);
    expect(screen.getByText(/hover over a cell/i)).toBeInTheDocument();
  });
});
