-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query → paste → Run
-- Creates the database from scratch. Moves are stored as PGN in games.pgn when game ends.

DROP TABLE IF EXISTS games CASCADE;

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  time_control_ms INTEGER NOT NULL,
  result TEXT,
  termination TEXT,
  player_color TEXT NOT NULL DEFAULT 'white',
  pgn TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_games_created_at ON games(created_at DESC);
CREATE INDEX idx_games_ended_at ON games(ended_at DESC) WHERE ended_at IS NOT NULL;
