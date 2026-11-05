// @vitest-environment node
//
// Migrations run against a live database shared by greek.tools and
// hebrew.tools, so each one is tested against data written before it: build
// the database at the previous schema, fill every table the way the apps do,
// migrate, and check that nothing already there changed.

import type Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createTestDbAt } from './test-utils';

type Row = Record<string, unknown>;

const TABLES = [
  'users',
  'sessions',
  'accounts',
  'verifications',
  'srs_cards',
  'study_stats',
  'sync_state',
  'custom_decks',
  'focus_passages',
  'focus_parse_history',
] as const;

/** Every row of every table, in a stable order. */
function snapshot(sqlite: Database.Database): Record<string, Row[]> {
  return Object.fromEntries(
    TABLES.map((t) => [t, sqlite.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all() as Row[]]),
  );
}

function columns(sqlite: Database.Database, table: string) {
  return sqlite.prepare(`PRAGMA table_info(${table})`).all() as Row[];
}

/** A student on each app, one on both, and one who signed in and never synced. */
function seedExistingUsers(sqlite: Database.Database) {
  const now = 1_790_000_000_000;
  const insertUser = sqlite.prepare(
    'INSERT INTO users (id, name, email, email_verified, image, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  for (const id of ['greek-only', 'hebrew-only', 'both', 'never-synced']) {
    insertUser.run(id, `Student ${id}`, `${id}@example.com`, 1, null, now, now);
  }
  sqlite
    .prepare(
      'INSERT INTO sessions (id, user_id, expires_at, token, created_at, updated_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run('s1', 'both', now + 1e9, 'token-1', now, now, '203.0.113.9', 'Safari');
  sqlite
    .prepare(
      'INSERT INTO accounts (id, user_id, account_id, provider_id, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, scope, id_token, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run('a1', 'both', 'g-123', 'google', 'at', 'rt', now, now, 'email', 'idt', null, now, now);
  sqlite
    .prepare(
      'INSERT INTO verifications (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run('v1', 'state', 'xyz', now, now, now);

  const card = sqlite.prepare(
    'INSERT INTO srs_cards (user_id, language, word_key, interval, repetition, ease_factor, due_date, last_reviewed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const hebrewKeys = [
    'מֶלֶךְ',
    'אַף#nose',
    'paradigm:qal-qatal-strong:3ms',
    'accent:davar-pl',
    'write:letter:ד',
  ];
  const greekKeys = ['λόγος', 'ἀγάπη', 'καί'];
  for (const user of ['hebrew-only', 'both']) {
    hebrewKeys.forEach((key, i) => {
      card.run(user, 'hebrew', key, i + 1, i, 1.3 + i * 0.15, '2026-11-0' + (i + 1), '2026-10-30');
    });
  }
  for (const user of ['greek-only', 'both']) {
    greekKeys.forEach((key, i) => {
      card.run(user, 'greek', key, 6, 2, 2.36, '2026-11-08', i ? '2026-10-29' : '');
    });
  }

  const stats = sqlite.prepare(
    'INSERT INTO study_stats (user_id, language, streak, last_streak_date, cards_studied_today, last_study_date, total_reviewed, total_correct) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  stats.run('greek-only', 'greek', 12, '2026-11-01', 31, '2026-11-01', 4210, 3650);
  stats.run('hebrew-only', 'hebrew', 4, '2026-11-02', 10, '2026-11-02', 380, 301);
  stats.run('both', 'greek', 0, '', 0, '', 15, 9);
  stats.run('both', 'hebrew', 1, '2026-10-20', 3, '2026-10-20', 77, 60);

  const synced = sqlite.prepare(
    'INSERT INTO sync_state (user_id, language, synced_at) VALUES (?, ?, ?)',
  );
  synced.run('greek-only', 'greek', '2026-11-01T20:00:00.000Z');
  synced.run('hebrew-only', 'hebrew', '2026-11-02T09:00:00.000Z');
  synced.run('both', 'greek', '2026-10-31T12:00:00.000Z');
  synced.run('both', 'hebrew', '2026-10-20T18:30:00.000Z');

  sqlite
    .prepare(
      'INSERT INTO custom_decks (id, user_id, language, name, word_keys, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run('d1', 'greek-only', 'greek', 'John 1', '["λόγος","καί"]', '2026-09-01');
  sqlite
    .prepare(
      'INSERT INTO focus_passages (user_id, id, label, book, start_chapter, start_verse, end_chapter, end_verse, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run('greek-only', 'p1', 'Prologue', 'JHN', 1, 1, 1, 18, '2026-09-02');
  sqlite
    .prepare(
      'INSERT INTO focus_parse_history (user_id, passage_id, correct, total) VALUES (?, ?, ?, ?)',
    )
    .run('greek-only', 'p1', 40, 52);
}

describe('0003: the Today study streak on study_stats', () => {
  it('changes no existing row, in any table, for either app', () => {
    const { sqlite, migrateRest } = createTestDbAt('0002');
    seedExistingUsers(sqlite);
    const before = snapshot(sqlite);
    migrateRest('0003');
    const after = snapshot(sqlite);

    for (const table of TABLES) {
      expect(after[table], table).toHaveLength(before[table].length);
      after[table].forEach((row, i) => {
        // Every value that was there is still there, unchanged.
        expect(row, `${table} row ${i}`).toMatchObject(before[table][i]);
      });
    }
    // And the data is not trivially empty: the comparison above had rows to check.
    expect(before.srs_cards).toHaveLength(16);
    expect(before.study_stats).toHaveLength(4);
  });

  it('gives every existing stats row an empty study streak and nothing else', () => {
    const { sqlite, migrateRest } = createTestDbAt('0002');
    seedExistingUsers(sqlite);
    const before = snapshot(sqlite).study_stats;
    migrateRest('0003');
    const after = snapshot(sqlite).study_stats;
    expect(after).toEqual(
      before.map((row) => ({ ...row, study_streak: 0, last_session_date: '' })),
    );
  });

  it('only adds the two columns; every other table keeps its exact shape', () => {
    const { sqlite, migrateRest } = createTestDbAt('0002');
    const shapes = Object.fromEntries(TABLES.map((t) => [t, columns(sqlite, t)]));
    migrateRest('0003');
    for (const table of TABLES) {
      const now = columns(sqlite, table);
      if (table !== 'study_stats') {
        expect(now, table).toEqual(shapes[table]);
        continue;
      }
      expect(now.slice(0, shapes[table].length)).toEqual(shapes[table]);
      expect(now.slice(shapes[table].length)).toMatchObject([
        { name: 'study_streak', type: 'INTEGER', notnull: 1, dflt_value: '0' },
        { name: 'last_session_date', type: 'TEXT', notnull: 1, dflt_value: "''" },
      ]);
    }
  });

  it('leaves the database consistent', () => {
    const { sqlite, migrateRest } = createTestDbAt('0002');
    seedExistingUsers(sqlite);
    migrateRest('0003');
    expect(sqlite.prepare('PRAGMA integrity_check').all()).toEqual([{ integrity_check: 'ok' }]);
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('still accepts a stats row written without the new columns, as the code before it does', () => {
    // The deploy migrates first and ships code second, so for a moment the old
    // code (and greek.tools until #197) writes rows that do not name them.
    const { sqlite, migrateRest } = createTestDbAt('0002');
    seedExistingUsers(sqlite);
    migrateRest('0003');
    sqlite.prepare("DELETE FROM study_stats WHERE user_id = 'greek-only'").run();
    sqlite
      .prepare(
        'INSERT INTO study_stats (user_id, language, streak, last_streak_date, cards_studied_today, last_study_date, total_reviewed, total_correct) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run('greek-only', 'greek', 13, '2026-11-02', 4, '2026-11-02', 4214, 3653);
    expect(
      sqlite.prepare("SELECT * FROM study_stats WHERE user_id = 'greek-only'").get(),
    ).toMatchObject({ streak: 13, total_reviewed: 4214, study_streak: 0, last_session_date: '' });
  });
});

describe('0004: the attempt log and ladder progress, as new tables', () => {
  /** The database as 0003 left it, with Today streaks written by the code that shipped with it. */
  function at0003() {
    const built = createTestDbAt('0003');
    seedExistingUsers(built.sqlite);
    built.sqlite
      .prepare(
        "UPDATE study_stats SET study_streak = ?, last_session_date = ? WHERE user_id = ? AND language = 'hebrew'",
      )
      .run(6, '2026-11-02', 'hebrew-only');
    return built;
  }

  it('changes no existing row, in any table, for either app', () => {
    const { sqlite, migrateRest } = at0003();
    const before = snapshot(sqlite);
    migrateRest('0004');
    expect(snapshot(sqlite)).toEqual(before);
    // The comparison had rows to check, including a 0003-era streak.
    expect(before.srs_cards).toHaveLength(16);
    expect(before.study_stats).toContainEqual(
      expect.objectContaining({ user_id: 'hebrew-only', study_streak: 6 }),
    );
  });

  it('leaves every existing table its exact shape', () => {
    const { sqlite, migrateRest } = at0003();
    const shapes = Object.fromEntries(TABLES.map((t) => [t, columns(sqlite, t)]));
    migrateRest('0004');
    for (const table of TABLES) expect(columns(sqlite, table), table).toEqual(shapes[table]);
  });

  it('adds the two tables, empty, keyed by user, language and their own id', () => {
    const { sqlite, migrateRest } = at0003();
    migrateRest('0004');
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM attempts').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM ladder_progress').get()).toEqual({ n: 0 });

    const key = (table: string) =>
      columns(sqlite, table)
        .filter((c) => Number(c.pk) > 0)
        .sort((a, b) => Number(a.pk) - Number(b.pk))
        .map((c) => c.name);
    expect(key('attempts')).toEqual(['user_id', 'language', 'id']);
    expect(key('ladder_progress')).toEqual(['user_id', 'language', 'rung_id']);
    expect(columns(sqlite, 'attempts')).toMatchObject([
      { name: 'user_id', notnull: 1 },
      { name: 'language', notnull: 1 },
      { name: 'id', notnull: 1 },
      { name: 'concept', notnull: 1 },
      { name: 'correct', notnull: 1 },
      { name: 'ms', notnull: 0 },
      { name: 'confidence', notnull: 0 },
      { name: 'at', notnull: 1 },
    ]);
  });

  it('leaves the database consistent', () => {
    const { sqlite, migrateRest } = at0003();
    migrateRest('0004');
    expect(sqlite.prepare('PRAGMA integrity_check').all()).toEqual([{ integrity_check: 'ok' }]);
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('keeps the code before it working: its progress writes touch neither table', () => {
    // The deploy migrates first and ships code second, so for a moment the old
    // code (and greek.tools) writes progress as it always has.
    const { sqlite, migrateRest } = at0003();
    migrateRest('0004');
    sqlite.prepare("DELETE FROM study_stats WHERE user_id = 'both' AND language = 'hebrew'").run();
    sqlite
      .prepare(
        'INSERT INTO study_stats (user_id, language, streak, last_streak_date, cards_studied_today, last_study_date, total_reviewed, total_correct, study_streak, last_session_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run('both', 'hebrew', 2, '2026-11-02', 5, '2026-11-02', 82, 64, 1, '2026-11-02');
    expect(
      sqlite
        .prepare("SELECT * FROM study_stats WHERE user_id = 'both' AND language = 'hebrew'")
        .get(),
    ).toMatchObject({ streak: 2, total_reviewed: 82, study_streak: 1 });
  });

  it('removes a user’s attempts and rungs with the user', () => {
    const { sqlite, migrateRest } = at0003();
    migrateRest('0004');
    sqlite
      .prepare(
        "INSERT INTO attempts (user_id, language, id, concept, correct, ms, confidence, at) VALUES ('hebrew-only', 'hebrew', 'a1', 'paradigm/x', 1, NULL, NULL, 1)",
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO ladder_progress (user_id, language, rung_id, clean_writes) VALUES ('hebrew-only', 'hebrew', 'suffix-bare-type1', 2)",
      )
      .run();
    sqlite.prepare("DELETE FROM users WHERE id = 'hebrew-only'").run();
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM attempts').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM ladder_progress').get()).toEqual({ n: 0 });
  });
});

describe('0005: tombstones and an update time on custom_decks', () => {
  /** The database as 0004 left it, with a greek deck written by the code before this change. */
  function at0004() {
    const built = createTestDbAt('0004');
    seedExistingUsers(built.sqlite);
    return built;
  }

  it('changes no existing value, in any table, for either app', () => {
    const { sqlite, migrateRest } = at0004();
    const before = snapshot(sqlite);
    migrateRest();
    const after = snapshot(sqlite);
    for (const table of TABLES) {
      expect(after[table], table).toHaveLength(before[table].length);
      after[table].forEach((row, i) => {
        expect(row, `${table} row ${i}`).toMatchObject(before[table][i]);
      });
    }
    // The comparison had a deck to check.
    expect(before.custom_decks).toHaveLength(1);
  });

  it('gives an existing deck an empty update time and no tombstone', () => {
    const { sqlite, migrateRest } = at0004();
    migrateRest();
    expect(sqlite.prepare('SELECT * FROM custom_decks').all()).toEqual([
      {
        id: 'd1',
        user_id: 'greek-only',
        language: 'greek',
        name: 'John 1',
        word_keys: '["λόγος","καί"]',
        created_at: '2026-09-01',
        updated_at: '',
        deleted_at: null,
      },
    ]);
  });

  it('only adds the two columns; every other table keeps its exact shape', () => {
    const { sqlite, migrateRest } = at0004();
    const shapes = Object.fromEntries(TABLES.map((t) => [t, columns(sqlite, t)]));
    migrateRest();
    for (const table of TABLES) {
      const now = columns(sqlite, table);
      if (table !== 'custom_decks') {
        expect(now, table).toEqual(shapes[table]);
        continue;
      }
      expect(now.slice(0, shapes[table].length)).toEqual(shapes[table]);
      expect(now.slice(shapes[table].length)).toMatchObject([
        { name: 'updated_at', type: 'TEXT', notnull: 1, dflt_value: "''" },
        { name: 'deleted_at', type: 'TEXT', notnull: 0, dflt_value: null },
      ]);
    }
  });

  it('leaves the database consistent', () => {
    const { sqlite, migrateRest } = at0004();
    migrateRest();
    expect(sqlite.prepare('PRAGMA integrity_check').all()).toEqual([{ integrity_check: 'ok' }]);
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('still accepts a deck row written without the new columns, as greek.tools does', () => {
    // The deploy migrates first and ships code second, and greek.tools does not
    // name the columns at all.
    const { sqlite, migrateRest } = at0004();
    migrateRest();
    sqlite
      .prepare(
        'INSERT INTO custom_decks (id, user_id, language, name, word_keys, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('d2', 'both', 'greek', 'Romans 8', '["πνεῦμα"]', '2026-10-01');
    expect(sqlite.prepare("SELECT * FROM custom_decks WHERE id = 'd2'").get()).toMatchObject({
      updated_at: '',
      deleted_at: null,
    });
  });
});
