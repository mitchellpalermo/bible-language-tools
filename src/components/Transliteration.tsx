import { useState } from 'react';
import { greekToTranslit, translitToGreek } from '../lib/transliteration';

type Source = 'greek' | 'translit';

export default function Transliteration() {
  const [greekText, setGreekText] = useState('');
  const [translitText, setTranslitText] = useState('');
  const [source, setSource] = useState<Source>('greek');
  const [copiedGreek, setCopiedGreek] = useState(false);
  const [copiedTranslit, setCopiedTranslit] = useState(false);

  // Derive the non-edited side from the edited side
  const displayGreek = source === 'translit' ? translitToGreek(translitText) : greekText;
  const displayTranslit = source === 'greek' ? greekToTranslit(greekText) : translitText;

  const handleGreekChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGreekText(e.target.value);
    setSource('greek');
  };

  const handleTranslitChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranslitText(e.target.value);
    setSource('translit');
  };

  const copyGreek = async () => {
    await navigator.clipboard.writeText(displayGreek);
    setCopiedGreek(true);
    setTimeout(() => setCopiedGreek(false), 2000);
  };

  const copyTranslit = async () => {
    await navigator.clipboard.writeText(displayTranslit);
    setCopiedTranslit(true);
    setTimeout(() => setCopiedTranslit(false), 2000);
  };

  const textareaClass =
    'w-full h-40 p-4 text-xl rounded-lg border-2 border-gray-200 focus:border-primary focus:outline-none resize-y';

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Greek side */}
        <div className="space-y-2">
          <label className="block font-semibold text-primary">Greek</label>
          <textarea
            value={displayGreek}
            onChange={handleGreekChange}
            placeholder="Paste or type Greek text…"
            className={textareaClass}
            style={{
              color: 'var(--color-greek)',
              fontFamily: 'var(--font-greek)',
              fontSize: '1.25rem',
            }}
            spellCheck={false}
          />
          <button
            onClick={copyGreek}
            disabled={!displayGreek}
            className="px-4 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors text-sm font-medium disabled:opacity-40"
          >
            {copiedGreek ? '✓ Copied!' : 'Copy Greek'}
          </button>
        </div>

        {/* Transliteration side */}
        <div className="space-y-2">
          <label className="block font-semibold text-primary">SBL Transliteration</label>
          <textarea
            value={displayTranslit}
            onChange={handleTranslitChange}
            placeholder="Or type SBL transliteration here…"
            className={textareaClass}
            spellCheck={false}
          />
          <button
            onClick={copyTranslit}
            disabled={!displayTranslit}
            className="px-4 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors text-sm font-medium disabled:opacity-40"
          >
            {copiedTranslit ? '✓ Copied!' : 'Copy Transliteration'}
          </button>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        Editing either side updates the other in real time. Reverse direction (transliteration →
        Greek) produces unaccented Greek.
      </p>

      <details className="bg-bg-card rounded-lg border border-gray-200 p-4">
        <summary className="font-semibold cursor-pointer text-primary">
          SBL Scheme Reference
        </summary>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1 text-sm">
          <div className="font-bold col-span-full mt-2 mb-1 text-text-muted">Vowels</div>
          {[
            ['α', 'a'],
            ['ε', 'e'],
            ['η', 'ē'],
            ['ι', 'i'],
            ['ο', 'o'],
            ['υ', 'y'],
            ['ω', 'ō'],
          ].map(([grk, lat]) => (
            <div key={grk} className="flex gap-2 items-center">
              <span className="font-greek text-lg" style={{ color: 'var(--color-greek)' }}>
                {grk}
              </span>
              <span className="text-text-muted">→</span>
              <span className="font-mono">{lat}</span>
            </div>
          ))}

          <div className="font-bold col-span-full mt-4 mb-1 text-text-muted">Consonants</div>
          {[
            ['θ', 'th'],
            ['φ', 'ph'],
            ['χ', 'ch'],
            ['ψ', 'ps'],
            ['β', 'b'],
            ['γ', 'g'],
            ['δ', 'd'],
            ['ζ', 'z'],
            ['κ', 'k'],
            ['λ', 'l'],
            ['μ', 'm'],
            ['ν', 'n'],
            ['ξ', 'x'],
            ['π', 'p'],
            ['ρ', 'r'],
            ['σ', 's'],
            ['τ', 't'],
          ].map(([grk, lat]) => (
            <div key={grk} className="flex gap-2 items-center">
              <span className="font-greek text-lg" style={{ color: 'var(--color-greek)' }}>
                {grk}
              </span>
              <span className="text-text-muted">→</span>
              <span className="font-mono">{lat}</span>
            </div>
          ))}

          <div className="font-bold col-span-full mt-4 mb-1 text-text-muted">Special cases</div>
          <div className="col-span-full grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1">
            {[
              ['γγ', 'ng'],
              ['γκ', 'nk'],
              ['γξ', 'nx'],
              ['γχ', 'nch'],
              ['ῥ', 'rh'],
              ['ᾳ', 'ai'],
              ['ῃ', 'ēi'],
              ['ῳ', 'ōi'],
              ['rough breathing', 'h (prefixed)'],
            ].map(([grk, lat]) => (
              <div key={grk} className="flex gap-2 items-center">
                <span className="font-greek" style={{ color: 'var(--color-greek)' }}>
                  {grk}
                </span>
                <span className="text-text-muted">→</span>
                <span className="font-mono">{lat}</span>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
