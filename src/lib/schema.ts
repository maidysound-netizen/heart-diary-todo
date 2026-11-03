// 첫 DB 연결 때 자동으로 실행된다 (CREATE ... IF NOT EXISTS).
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  title VARCHAR(160) NOT NULL DEFAULT '',
  content_text TEXT NOT NULL DEFAULT '',
  mood VARCHAR(24),
  drawing_data JSONB,
  template_key VARCHAR(40) NOT NULL DEFAULT '05_daily',
  page_layout JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, entry_date)
);

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES diary_entries(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS todos_owner_due ON todos (owner_id, due_at);

CREATE TABLE IF NOT EXISTS diary_settings (
  owner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cover_color VARCHAR(16) NOT NULL DEFAULT '#E8A6B5',
  ribbon_key VARCHAR(24) NOT NULL DEFAULT 'rose',
  chain_key VARCHAR(24) NOT NULL DEFAULT 'gold',
  charm_key VARCHAR(24) NOT NULL DEFAULT 'heart',
  nagging_mode BOOLEAN NOT NULL DEFAULT false,
  voice_enabled BOOLEAN NOT NULL DEFAULT false,
  hub_layout JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
