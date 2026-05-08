import { useCallback, useState } from 'react';
import {
  type AdjParadigm,
  CASE_DESCRIPTIONS,
  CASE_LABELS,
  CASES,
  type CaseKey,
  GENDER_LABELS,
  GENDERS,
  type GenderKey,
  NUM_LABELS,
  NUMBERS,
  type NumKey,
} from '../../data/grammar';
import DescriptionBar from './DescriptionBar';
import EndingsToggle from './EndingsToggle';
import NumberToggle from './NumberToggle';

export default function AdjParadigmCard({ paradigm }: { paradigm: AdjParadigm }) {
  const [showEndings, setShowEndings] = useState(false);
  const [description, setDescription] = useState<string | null>(null);
  const [activeNumber, setActiveNumber] = useState<NumKey>('sg');

  const handleCell = useCallback((caseKey: CaseKey, numKey: NumKey, genderKey: GenderKey) => {
    setDescription(
      `${CASE_DESCRIPTIONS[caseKey].split(' — ')[0]} ${NUM_LABELS[numKey]} ${GENDER_LABELS[genderKey]} — ${CASE_DESCRIPTIONS[caseKey].split(' — ')[1]}`,
    );
  }, []);

  return (
    <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #e5e7eb' }}>
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ background: 'var(--color-primary)' }}
      >
        <span className="text-sm font-semibold text-white">{paradigm.name}</span>
        <div className="flex items-center gap-2">
          <NumberToggle activeNumber={activeNumber} onToggle={setActiveNumber} />
          <EndingsToggle showEndings={showEndings} onToggle={() => setShowEndings((v) => !v)} />
        </div>
      </div>

      {/* Desktop: full 6-column table */}
      <div
        className="hidden md:block overflow-x-auto"
        style={{ background: 'var(--color-bg-card)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(30,58,95,0.06)' }}>
              <th
                className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)', width: '4rem' }}
              />
              {NUMBERS.map((num) => (
                <th
                  key={num}
                  colSpan={3}
                  className="px-2 py-2 text-center font-semibold text-xs uppercase tracking-wider border-l"
                  style={{ color: 'var(--color-text-muted)', borderColor: '#e5e7eb' }}
                >
                  {NUM_LABELS[num]}
                </th>
              ))}
            </tr>
            <tr style={{ background: 'rgba(30,58,95,0.03)' }}>
              <th />
              {NUMBERS.map((num) =>
                GENDERS.map((g) => (
                  <th
                    key={`${num}-${g}`}
                    className="px-3 py-1.5 text-center text-xs font-medium"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {GENDER_LABELS[g]}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {CASES.map((c, i) => (
              <tr
                key={c}
                style={{ background: i % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.03)' }}
              >
                <td
                  className="px-3 py-2 font-semibold text-xs uppercase tracking-wider cursor-default"
                  style={{ color: 'var(--color-text-muted)' }}
                  onMouseEnter={() => setDescription(CASE_DESCRIPTIONS[c])}
                  onMouseLeave={() => setDescription(null)}
                >
                  {CASE_LABELS[c]}
                </td>
                {NUMBERS.map((num) =>
                  GENDERS.map((g) => (
                    <td
                      key={`${num}-${g}`}
                      className="px-3 py-2 text-center font-greek text-sm cursor-default"
                      style={{ color: 'var(--color-greek)' }}
                      onMouseEnter={() => handleCell(c, num, g)}
                      onMouseLeave={() => setDescription(null)}
                      onClick={() => handleCell(c, num, g)}
                    >
                      {paradigm.forms[c][num][g]}
                    </td>
                  )),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: 3-column table with Sg/Pl toggle */}
      <div className="md:hidden" style={{ background: 'var(--color-bg-card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(30,58,95,0.06)' }}>
              <th
                className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)', width: '4rem' }}
              />
              {GENDERS.map((g) => (
                <th
                  key={g}
                  className="px-3 py-2 text-center text-xs font-medium"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {GENDER_LABELS[g]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CASES.map((c, i) => (
              <tr
                key={c}
                style={{ background: i % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.03)' }}
              >
                <td
                  className="px-3 py-2 font-semibold text-xs uppercase tracking-wider cursor-default"
                  style={{ color: 'var(--color-text-muted)' }}
                  onClick={() => setDescription(CASE_DESCRIPTIONS[c])}
                >
                  {CASE_LABELS[c]}
                </td>
                {GENDERS.map((g) => (
                  <td
                    key={g}
                    className="px-3 py-2 text-center font-greek text-sm cursor-default"
                    style={{ color: 'var(--color-greek)' }}
                    onClick={() => handleCell(c, activeNumber, g)}
                  >
                    {paradigm.forms[c][activeNumber][g]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-3 pb-3 pt-1" style={{ background: 'var(--color-bg-card)' }}>
        <DescriptionBar text={description} />
      </div>
    </div>
  );
}
