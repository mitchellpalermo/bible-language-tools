import { sql } from 'drizzle-orm';
import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Shape required by Better Auth's user model — name, email_verified, image,
// and updated_at are managed by Better Auth. SQLite ALTER TABLE ADD COLUMN
// needs constant defaults for NOT NULL columns, hence the defaults here;
// Better Auth always writes explicit values on insert/update.
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default(''),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`0`),
});

// Managed by Better Auth — shape defined here so Drizzle owns the migration.
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const verifications = sqliteTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
});

// ─── Per-language progress tables ────────────────────────────────────────────

export type Language = 'greek' | 'hebrew';

export const srsCards = sqliteTable(
  'srs_cards',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    language: text('language').$type<Language>().notNull(),
    wordKey: text('word_key').notNull(),
    interval: integer('interval').notNull(),
    repetition: integer('repetition').notNull(),
    easeFactor: real('ease_factor').notNull(),
    dueDate: text('due_date').notNull(),
    lastReviewed: text('last_reviewed').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.language, t.wordKey] })],
);

export const studyStats = sqliteTable('study_stats', {
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  language: text('language').$type<Language>().notNull(),
  streak: integer('streak').notNull().default(0),
  lastStreakDate: text('last_streak_date').notNull().default(''),
  cardsStudiedToday: integer('cards_studied_today').notNull().default(0),
  lastStudyDate: text('last_study_date').notNull().default(''),
  totalReviewed: integer('total_reviewed').notNull().default(0),
  totalCorrect: integer('total_correct').notNull().default(0),
});

// One row per user+language, written on every successful progress PUT.
// Its absence is the signal that the user has never synced (GET → data: null).
export const syncState = sqliteTable(
  'sync_state',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    language: text('language').$type<Language>().notNull(),
    syncedAt: text('synced_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.language] })],
);

export const customDecks = sqliteTable('custom_decks', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  language: text('language').$type<Language>().notNull(),
  name: text('name').notNull(),
  wordKeys: text('word_keys').notNull(),
  createdAt: text('created_at').notNull(),
});

export const focusPassages = sqliteTable(
  'focus_passages',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    label: text('label'),
    book: text('book').notNull(),
    startChapter: integer('start_chapter').notNull(),
    startVerse: integer('start_verse').notNull(),
    endChapter: integer('end_chapter').notNull(),
    endVerse: integer('end_verse').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const focusParseHistory = sqliteTable(
  'focus_parse_history',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    passageId: text('passage_id').notNull(),
    correct: integer('correct').notNull().default(0),
    total: integer('total').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.passageId] })],
);
