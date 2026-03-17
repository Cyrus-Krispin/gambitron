# Database Schema

## Create from scratch in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. Go to **SQL Editor** → **New query**
3. Copy and paste the contents of `schema.sql`, then run

## Verify connection

After deploying the backend, check:

```bash
curl https://api.gambitron.xyz/db-check
```

Expected when working:
```json
{
  "connected": true,
  "tables": {"games": true},
  "games_count": 0
}
```

Completed games are stored as PGN in `games.pgn`. If `connected: false`, check the `reason` field for the error (e.g. wrong password, tables missing).
