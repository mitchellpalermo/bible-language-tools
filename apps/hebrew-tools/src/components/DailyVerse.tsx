import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type DailyDoseFailure, fetchDailyDoseVerse } from '../data/dailyDose';
import {
  type DailyStreakData,
  type DailyVerseRef,
  getTodayVerse,
  markReadToday,
} from '../data/dailyVerses';
import {
  DEFAULT_READER_PREFS,
  fetchBook,
  fetchBooks,
  fetchLemmas,
  type HebrewBookMeta,
  type HebrewWord,
  loadReaderPrefs,
  type ReaderPrefs,
  saveReaderPrefs,
} from '../data/morphhb';
import { logAttempts } from '../lib/attempt-log';
import { loadParseSettings } from '../lib/parse-settings';
import { formatRef, hebrewNumeral } from '../lib/reader';
import { lemmaBase, loadStudiedLemmas } from '../lib/studied';
import { type ParseGrade, type ParseLemma, parseVerbConcept } from '../lib/verb-parse';
import { type VerseParseItem, verseLemmas, verseVerbs } from '../lib/verse-parse';
import DailyVerseParse from './DailyVerseParse';
import ErrorBoundary from './ErrorBoundary';
import { type ActiveWord, MarkLegend, useGlossLine, WordPopup, WordRun } from './HebrewText';
import PrefToggle from './PrefToggle';

/**
 * `/daily` — one verse of the Hebrew Bible a day (Phase 3b, #129).
 *
 * The verse is today's Daily Dose of Scripture Hebrew lesson when the feed
 * answers, and the curated list's verse for today when it does not. Everything
 * about reading it is the reader's: the word and its popup are `HebrewText`,
 * the cantillation preference is `ReaderPrefs`, highlighting is
 * `loadStudiedLemmas`. What is this page's own is the choice of verse, the
 * streak, and the two references.
 *
 * **"Parse this verse" asks the verse's verbs, in context.** The quiz is
 * `DailyVerseParse`: /parse's screens and grading over the shared inline quiz,
 * with the verse's own reading as the answer. Which words are asked is /parse's
 * rule (`verseVerbs`), so a jussive, a verb with an object suffix or a ketiv is
 * not. Whether the root is asked is /parse's setting, and the lemma index the
 * root comes from is fetched when the quiz opens, never on page load. Answers
 * go to the attempt log under the same concepts /parse uses.
 *
 * **The gloss line is BDB's, and it is off until asked for.** Strong's often
 * leads with a word's root sense — "assemblage" for גַּם, "deputyship" for
 * מְלָאכָה — which is why #179 shipped without a line at all. BDB reads
 * "also" and "occupation, work", and a verb gets its own stem's sense
 * (`lineGloss` in `src/lib/gloss.ts`). The course vocabulary may not stand in
 * for either (see "Glosses" in CLAUDE.md). The preference is the reader's,
 * `ReaderPrefs.glosses`, and `useGlossLine` fetches `glosses.json` only once
 * it is on.
 *
 * Why a fallback is reported, not just taken: it looks exactly like a normal
 * page, so a broken feed hides. `hebrew_daily_verse_viewed` carries `source`
 * and, on a fallback, `fallback_reason`. One reason is Hebrew's own —
 * `not_in_text`, a lesson whose reference the corpus does not have. The feed
 * numbers verses the way the Hebrew Bible does today; if it ever switched to
 * English numbering, that is how it would first show up.
 */

type FallbackReason = DailyDoseFailure | 'not_in_text';

/** An open quiz: what the grading needs, read when it opened. */
interface ParseQuiz {
  askRoot: boolean;
  lemmas: Record<string, ParseLemma>;
}

interface Today {
  ref: DailyVerseRef;
  words: HebrewWord[];
  /** The Daily Dose lesson, when the verse is one. */
  lessonLink: string | null;
  fallbackReason: FallbackReason | null;
}

function wordsAt(book: Record<string, Record<string, HebrewWord[]>>, ref: DailyVerseRef) {
  return book[String(ref.chapter)]?.[String(ref.verse)] ?? [];
}

/** Pick today's verse and load its words. Throws only if the text will not load. */
async function loadToday(books: HebrewBookMeta[]): Promise<Today> {
  const lesson = await fetchDailyDoseVerse(books);

  if (lesson.ok) {
    const words = wordsAt(await fetchBook(lesson.verse.book), lesson.verse);
    if (words.length > 0) {
      return { ref: lesson.verse, words, lessonLink: lesson.link, fallbackReason: null };
    }
  }

  const ref = getTodayVerse();
  return {
    ref,
    words: wordsAt(await fetchBook(ref.book), ref),
    lessonLink: null,
    fallbackReason: lesson.ok ? 'not_in_text' : lesson.reason,
  };
}

/** "Genesis 1:1" as a Tanakh prints it: בְּרֵאשִׁית א:א. */
export function hebrewReference(ref: DailyVerseRef, books: HebrewBookMeta[]): string | null {
  const book = books.find((b) => b.code === ref.book);
  if (!book) return null;
  return `${book.hebrew} ${hebrewNumeral(ref.chapter)}:${hebrewNumeral(ref.verse)}`;
}

function DailyVerseInner() {
  const [books, setBooks] = useState<HebrewBookMeta[]>([]);
  const [today, setToday] = useState<Today | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveWord | null>(null);
  const [streak, setStreak] = useState<DailyStreakData>({ streak: 0, lastReadDate: '' });
  // The quiz lives in memory only: every visit starts in reading mode, which
  // also keeps the first render identical to the server's.
  const [quiz, setQuiz] = useState<ParseQuiz | null>(null);
  const [opening, setOpening] = useState(false);
  const [parseTarget, setParseTarget] = useState<number | null>(null);

  // Read on mount, not during render: the page is prerendered, and
  // localStorage is not there when the markup is built.
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_READER_PREFS);
  const [studied, setStudied] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setPrefs(loadReaderPrefs());
    setStudied(loadStudiedLemmas());
    // Opening the page is the reading. Idempotent within a day.
    setStreak(markReadToday());

    let cancelled = false;
    (async () => {
      // The index is needed to recognise a lesson's book and for the Hebrew
      // reference. Without it the curated verse still loads.
      const index = await fetchBooks().catch(() => [] as HebrewBookMeta[]);
      if (cancelled) return;
      setBooks(index);
      try {
        const loaded = await loadToday(index);
        if (cancelled) return;
        setToday(loaded);
        posthog.capture('hebrew_daily_verse_viewed', {
          verse_reference: loaded.ref.displayRef,
          source: loaded.fallbackReason ? 'curated' : 'daily_dose',
          ...(loaded.fallbackReason ? { fallback_reason: loaded.fallbackReason } : {}),
        });
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const togglePref = useCallback((key: 'cantillation' | 'glosses') => {
    setPrefs((current) => {
      const next = { ...current, [key]: !current[key] };
      saveReaderPrefs(next);
      return next;
    });
  }, []);
  const toggleCantillation = useCallback(() => togglePref('cantillation'), [togglePref]);
  const toggleGlosses = useCallback(() => togglePref('glosses'), [togglePref]);

  const glossOf = useGlossLine(prefs.glosses);

  const activate = useCallback(
    (word: HebrewWord, rect: DOMRect) => {
      // The popup shows the parse, so it stays shut while a verb is being asked.
      if (parseTarget !== null) return;
      setActive((prev) => (prev?.word === word ? null : { word, rect }));
    },
    [parseTarget],
  );
  const close = useCallback(() => setActive(null), []);

  const isStudied = useCallback(
    (word: HebrewWord) => prefs.studied && studied.has(lemmaBase(word.lemma)),
    [prefs.studied, studied],
  );

  const words = today?.words ?? [];
  const verbs = useMemo(() => verseVerbs(today?.words ?? []), [today]);
  const verseReference = today?.ref.displayRef;

  async function startParsing() {
    setActive(null);
    setOpening(true);
    let { askRoot } = loadParseSettings();
    let lemmas: Record<string, ParseLemma> = {};
    if (askRoot) {
      // Without the lemma index there is no root to mark against, so the quiz
      // still opens and leaves the root out.
      try {
        lemmas = verseLemmas(verbs, await fetchLemmas());
      } catch {
        askRoot = false;
      }
    }
    setOpening(false);
    setQuiz({ askRoot, lemmas });
    posthog.capture('hebrew_daily_parse_started', {
      verse_reference: verseReference,
      verb_count: verbs.length,
      ask_root: askRoot,
    });
  }

  const closeQuiz = useCallback(() => setQuiz(null), []);

  const handleParseAnswer = useCallback(
    (_item: VerseParseItem, grade: ParseGrade) => {
      logAttempts([{ concept: parseVerbConcept(grade.reading), correct: grade.allCorrect }]);
      posthog.capture('hebrew_daily_parse_answered', {
        verse_reference: verseReference,
        stem: grade.reading.stem,
        conjugation: grade.reading.conjugation,
        all_correct: grade.allCorrect,
      });
    },
    [verseReference],
  );

  const handleParseFinish = useCallback(
    (grades: ParseGrade[]) => {
      posthog.capture('hebrew_daily_parse_finished', {
        verse_reference: verseReference,
        correct: grades.filter((g) => g.allCorrect).length,
        total: grades.length,
      });
    },
    [verseReference],
  );
  const marks = {
    studied: words.some(isStudied),
    qere: words.some((w) => w.qere !== undefined || w.qereOnly === true),
  };
  const hebrewRef = today ? hebrewReference(today.ref, books) : null;

  return (
    // Anywhere else on the page dismisses the popup.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it; see WordPopup
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop
    <div onClick={close}>
      {streak.streak > 0 && (
        <p
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-sm font-semibold"
          style={{ background: '#FEF3C7', color: '#92400E' }}
        >
          <span aria-hidden="true">🔥</span>
          {streak.streak === 1 ? '1-day streak — keep it going!' : `${streak.streak}-day streak`}
        </p>
      )}

      <div className="bg-bg-card rounded-2xl shadow-sm border-2 border-primary/5 p-6 sm:p-8 mb-4">
        {loading && <p className="text-text-muted text-center py-10">Loading…</p>}

        {error && (
          <div className="text-center py-10 space-y-2">
            <p className="text-red-600 text-sm">Could not load today’s verse: {error}</p>
            <p className="text-text-muted text-xs">
              Run <code className="bg-primary/5 px-1 rounded">pnpm build:data</code> to generate the
              text files.
            </p>
          </div>
        )}

        {!loading && !error && today && (
          <>
            <div
              dir="rtl"
              lang="he"
              data-testid="daily-verse-text"
              style={{
                fontFamily: 'var(--font-hebrew)',
                color: 'var(--color-hebrew)',
                fontSize: '1.75rem',
                lineHeight: 2.1,
                wordSpacing: '0.12em',
              }}
            >
              <WordRun
                words={today.words}
                cantillation={prefs.cantillation}
                isStudied={isStudied}
                active={parseTarget !== null ? today.words[parseTarget] : (active?.word ?? null)}
                onActivate={activate}
                glossOf={glossOf}
              />
            </div>

            {/* ── References ─────────────────────────────────────────────── */}
            <div className="flex items-baseline justify-between flex-wrap gap-x-4 gap-y-1 mt-6 pt-4 border-t-2 border-primary/5">
              <p className="text-sm font-semibold text-text-muted">— {today.ref.displayRef}</p>
              {hebrewRef && (
                <p
                  dir="rtl"
                  lang="he"
                  className="text-lg"
                  style={{ fontFamily: 'var(--font-hebrew)', color: 'var(--color-hebrew)' }}
                >
                  {hebrewRef}
                </p>
              )}
            </div>

            {today.ref.english && (
              <p className="text-text-muted text-xs mt-2" data-testid="english-numbering">
                English Bibles number this verse <strong>{today.ref.english}</strong>. The Hebrew
                Bible counts some psalm titles as verses and divides a few chapters differently, so
                the reference above is the Hebrew one.
              </p>
            )}

            {/* ── Controls ───────────────────────────────────────────────── */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation keeps the popup */}
            <div className="flex flex-wrap gap-2 mt-5" onClick={(e) => e.stopPropagation()}>
              <PrefToggle on={prefs.cantillation} onChange={toggleCantillation}>
                Cantillation
              </PrefToggle>
              <PrefToggle on={prefs.glosses} onChange={toggleGlosses}>
                Glosses
              </PrefToggle>
              {verbs.length > 0 && !quiz && (
                <button
                  type="button"
                  onClick={startParsing}
                  disabled={opening}
                  className="px-3 py-2 rounded-xl text-sm font-semibold border-2 border-primary/30 text-primary hover:border-primary transition-colors disabled:opacity-60"
                >
                  {opening ? 'Loading…' : 'Parse this verse'}
                </button>
              )}
              <a
                href={`/reader?ref=${formatRef(today.ref)}`}
                className="px-3 py-2 rounded-xl text-sm font-semibold border-2 border-primary/10 text-text-muted hover:border-primary/40 transition-colors"
              >
                Open chapter →
              </a>
              {today.lessonLink && (
                <a
                  href={today.lessonLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Watch the lesson on this verse from Daily Dose of Scripture"
                  className="px-3 py-2 rounded-xl text-sm font-semibold border-2 border-accent/30 text-accent hover:border-accent transition-colors"
                >
                  Watch the Daily Dose ↗
                </a>
              )}
            </div>

            {quiz && (
              // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation keeps the backdrop from closing anything
              // biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only
              <div
                // The quiz's menus and bars are drawn in the card color, for the
                // page background /parse puts them on. Inside this white card
                // they need that background back, or they draw with no edges.
                className="mt-6 -mx-4 sm:mx-0 rounded-xl bg-bg p-4 sm:p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <DailyVerseParse
                  items={verbs}
                  lemmas={quiz.lemmas}
                  askRoot={quiz.askRoot}
                  onClose={closeQuiz}
                  onTargetChange={setParseTarget}
                  onAnswer={handleParseAnswer}
                  onFinish={handleParseFinish}
                />
              </div>
            )}

            {/* The page intro credits Daily Dose; say so when this verse is not theirs. */}
            {!today.lessonLink && (
              <p className="text-text-muted text-xs mt-4">
                Today’s Daily Dose of Scripture lesson didn’t load, so this verse comes from the
                hebrew.tools reading list.
              </p>
            )}

            <MarkLegend studied={marks.studied} qere={marks.qere} className="mt-4" />
          </>
        )}
      </div>

      {active && <WordPopup active={active} cantillation={prefs.cantillation} onClose={close} />}
    </div>
  );
}

export default function DailyVerse() {
  return (
    <ErrorBoundary component="DailyVerse">
      <DailyVerseInner />
    </ErrorBoundary>
  );
}
