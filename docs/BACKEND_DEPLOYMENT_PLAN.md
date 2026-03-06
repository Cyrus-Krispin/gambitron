# Backend Implementation & Deployment Plan

Detailed plan for backend changes and GitHub Actions deployment to EC2.

---

## Part 1: Backend Implementation Tasks

### 1.1 Create New Backend Structure

Create `backend/` directory (separate from `lambda-backend/` for now; can deprecate lambda later).

```
backend/
├── main.py
├── chess_engine.py
├── config.py
├── db/
│   ├── __init__.py
│   ├── connection.py
│   ├── games.py
│   └── moves.py
├── routes/
│   ├── __init__.py
│   ├── games.py
│   └── health.py
├── requirements.txt
└── .env.example
```

---

### 1.2 Task Breakdown

#### Task 1: `config.py` — Settings

- [ ] Load env vars: `DATABASE_URL`, `ALLOWED_ORIGINS` (default `["*"]`)
- [ ] Use `python-dotenv` for local `.env`
- [ ] `ALLOWED_ORIGINS` can be comma-separated string, split into list

#### Task 2: `chess_engine.py` — Extract AI Logic

- [ ] Copy from `lambda-backend/backend.py`: all constants, `evaluate_board_state`, `minimax`, `select_best_move`, `get_best_move`
- [ ] Return type: `{"updated_fen": str, "result": str}` plus optionally `chosen_move` (chess.Move) for SAN/from/to
- [ ] Add helper to get SAN and from/to squares from the move (for DB storage)

#### Task 3: `db/connection.py` — PostgreSQL Pool

- [ ] Use `asyncpg` for async (recommended with FastAPI) or `psycopg` for sync
- [ ] Create connection pool on startup
- [ ] `get_pool()` or global pool; close on shutdown
- [ ] Handle missing `DATABASE_URL` (e.g. skip DB if not set, for local dev without Supabase)

#### Task 4: `db/games.py` — Game CRUD

- [ ] `create_game(time_control_ms, player_color)` → returns `game_id` (UUID)
- [ ] `get_game(game_id)` → dict or None
- [ ] `list_games(limit, offset)` → list of games + total count
- [ ] `update_game_ended(game_id, result, termination, pgn?)` → void

#### Task 5: `db/moves.py` — Move CRUD

- [ ] `insert_move(game_id, ply, fen, san, from_square, to_square)` → void
- [ ] `get_moves_by_game(game_id)` → list of moves ordered by ply
- [ ] `get_move_count(game_id)` → int (for next ply)

#### Task 6: `routes/health.py` — Health Check

- [ ] `GET /health` → `{"status": "ok"}` or `{"status": "ok", "db": "connected"}`
- [ ] Optional: ping DB to verify connection

#### Task 7: `routes/games.py` — REST Endpoints

- [ ] `GET /games?limit=20&offset=0` → paginated list
- [ ] `GET /games/{game_id}` → single game (404 if not found)
- [ ] `GET /games/{game_id}/moves` → moves for replay

#### Task 8: `main.py` — FastAPI App

- [ ] Include CORS middleware (use `ALLOWED_ORIGINS`)
- [ ] Include router for `/health`
- [ ] Include router for `/games` (prefix `/games` for games routes)
- [ ] Keep existing `POST /` (FEN → AI move) for backward compatibility
- [ ] Startup: init DB pool
- [ ] Shutdown: close DB pool

#### Task 9: `requirements.txt`

```
fastapi
uvicorn[standard]
chess
asyncpg
python-dotenv
```

#### Task 10: `.env.example`

```
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
ALLOWED_ORIGINS=https://gambitron.vercel.app,http://localhost:5173
```

---

### 1.3 Supabase Schema (Run Manually)

Run this in Supabase SQL Editor before first deploy:

```sql
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

CREATE TABLE moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ply INTEGER NOT NULL,
  fen TEXT NOT NULL,
  san TEXT NOT NULL,
  from_square TEXT,
  to_square TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, ply)
);

CREATE INDEX idx_moves_game_id ON moves(game_id);
CREATE INDEX idx_moves_game_ply ON moves(game_id, ply);
```

---

## Part 2: EC2 Setup (One-Time, Before GitHub Actions)

### 2.1 EC2 Instance

- [ ] Launch Ubuntu 22.04 LTS (t3.small or t3.micro)
- [ ] Security group: allow 22 (SSH), 80 (HTTP), 443 (HTTPS)
- [ ] Attach Elastic IP (optional but recommended for stable DNS)
- [ ] Store key pair (.pem) securely — needed for GitHub Actions

### 2.2 Initial EC2 Setup (SSH in and run)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.11+
sudo apt install -y python3.11 python3.11-venv python3-pip

# Create app user (optional, or use ubuntu)
sudo useradd -m -s /bin/bash gambitron
sudo usermod -aG sudo gambitron  # or skip if using ubuntu

# Create app directory and clone repo (replace with your repo URL)
sudo mkdir -p /opt/gambitron
sudo chown $USER:$USER /opt/gambitron
cd /opt/gambitron
git clone https://github.com/YOUR_USER/gambitron.git .
# For private repo, use: git clone git@github.com:YOUR_USER/gambitron.git .
```

### 2.3 Deploy User & SSH Key for GitHub Actions

GitHub Actions will SSH into EC2 and deploy. You need:

1. **SSH key pair** for deploy (separate from your personal key, or reuse):
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key -N ""
   ```
   - `deploy_key` (private) → GitHub Secrets
   - `deploy_key.pub` (public) → EC2 `~/.ssh/authorized_keys` of the user that will run deploys

2. **Add public key to EC2**:
   ```bash
   # On your machine, after generating deploy_key
   ssh -i your-existing-key.pem ubuntu@<EC2_IP>
   # On EC2:
   echo "PASTE deploy_key.pub CONTENTS" >> ~/.ssh/authorized_keys
   ```

3. **GitHub Secrets** (Settings → Secrets and variables → Actions):
   - `EC2_HOST` — e.g. `api.gambitron.xyz` or `3.xx.xx.xx`
   - `EC2_USER` — e.g. `ubuntu`
   - `EC2_SSH_KEY` — entire contents of `deploy_key` (private key)
   - `DATABASE_URL` — Supabase connection string (for deploy script to write to .env on EC2)

### 2.4 Systemd Service (Create on EC2)

Create `/etc/systemd/system/gambitron.service`:

```ini
[Unit]
Description=Gambitron FastAPI
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/gambitron/backend
EnvironmentFile=/opt/gambitron/.env
ExecStart=/opt/gambitron/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable gambitron
# First start will fail until backend/ exists and is deployed
```

### 2.5 Nginx Reverse Proxy (Optional but Recommended)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
# Configure nginx for api.gambitron.xyz → localhost:8000
# certbot --nginx -d api.gambitron.xyz
```

Example nginx config (`/etc/nginx/sites-available/gambitron`):

```nginx
server {
    listen 80;
    server_name api.gambitron.xyz;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;  # For WebSocket long connections
    }
}
```

---

## Part 3: GitHub Actions Deployment

### 3.1 Workflow: Deploy on Push to `main`

Create `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to EC2

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-backend.yml'
  workflow_dispatch:  # Allow manual trigger

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /opt/gambitron
            git fetch origin main
            git reset --hard origin/main
            python3.11 -m venv venv 2>/dev/null || true
            . venv/bin/activate
            pip install -r backend/requirements.txt
            # Copy backend files to app root (or run from backend/)
            cp -r backend/* .
            # Create .env if not exists
            if [ ! -f .env ]; then
              echo "DATABASE_URL=${{ secrets.DATABASE_URL }}" > .env
              echo "ALLOWED_ORIGINS=*" >> .env
            fi
            sudo systemctl restart gambitron
```

**Note**: The above runs from `/opt/gambitron` and assumes we `git clone` the repo there first (one-time setup). Alternative: use `rsync` to copy files instead of git pull.

### 3.2 Alternative: Rsync-Based Deploy (No Git on EC2)

If you prefer not to clone the repo on EC2:

```yaml
name: Deploy Backend to EC2

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-backend.yml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.EC2_SSH_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H ${{ secrets.EC2_HOST }} >> ~/.ssh/known_hosts

      - name: Rsync backend to EC2
        run: |
          rsync -avz --delete \
            -e "ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no" \
            backend/ ${{ secrets.EC2_USER }}@${{ secrets.EC2_HOST }}:/opt/gambitron/

      - name: Deploy and restart
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /opt/gambitron
            python3.11 -m venv venv 2>/dev/null || true
            . venv/bin/activate
            pip install -r requirements.txt
            sudo systemctl restart gambitron
```

For rsync, EC2 needs the backend files in `/opt/gambitron` with `requirements.txt` at that path. The `backend/` folder structure should flatten: `backend/requirements.txt` → `/opt/gambitron/requirements.txt`, `backend/main.py` → `/opt/gambitron/main.py`, etc.

### 3.3 Recommended: Git-Based Deploy

Simpler long-term: clone repo on EC2 once, then `git pull` on deploy.

**One-time on EC2:**
```bash
cd /opt/gambitron
git clone https://github.com/YOUR_USER/gambitron.git .
# Or clone with deploy key if private repo
```

**Workflow** (refined):

```yaml
name: Deploy Backend to EC2

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-backend.yml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script_stderr: true
          script: |
            set -e
            cd /opt/gambitron
            git fetch origin main
            git reset --hard origin/main
            cd backend
            python3.11 -m venv ../venv 2>/dev/null || true
            . ../venv/bin/activate
            pip install -q -r requirements.txt
            cd ..
            # Ensure .env exists
            if [ ! -f /opt/gambitron/.env ]; then
              echo "DATABASE_URL=${{ secrets.DATABASE_URL }}" > /opt/gambitron/.env
              echo "ALLOWED_ORIGINS=*" >> /opt/gambitron/.env
            fi
            # Run from backend dir; uvicorn needs to find main:app
            sudo systemctl restart gambitron
```

**Systemd adjustment** if app lives in `backend/`:

```ini
WorkingDirectory=/opt/gambitron/backend
ExecStart=/opt/gambitron/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Part 4: Checklist Summary

### Before First Deploy

- [ ] Create Supabase project, run schema SQL
- [ ] Add `DATABASE_URL` to GitHub Secrets
- [ ] Spin up EC2, configure security group
- [ ] Generate deploy SSH key, add public key to EC2
- [ ] Add `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` to GitHub Secrets
- [ ] Clone repo to `/opt/gambitron` on EC2 (or create dir for rsync)
- [ ] Create systemd service
- [ ] Create `.env` on EC2 (or let workflow create it from `DATABASE_URL` secret)
- [ ] Install Nginx + SSL (optional for first test)

### Backend Code

- [ ] Create `backend/` with all files per Task 1–10
- [ ] Add `.github/workflows/deploy-backend.yml`
- [ ] Push to `main`; workflow runs and deploys

### Verify

- [ ] `curl https://api.gambitron.xyz/health` returns 200
- [ ] `curl -X POST "https://api.gambitron.xyz/?value=..."` returns AI move
- [ ] `GET /games` returns `[]` or list

---

## Part 5: File Layout for `backend/`

Ensure `main.py` and `uvicorn` can resolve the app. Two options:

**Option A**: Run from `backend/` directory
- `WorkingDirectory=/opt/gambitron/backend`
- `ExecStart=.../venv/bin/uvicorn main:app ...`

**Option B**: Run from repo root with module path
- `WorkingDirectory=/opt/gambitron`
- `ExecStart=.../venv/bin/uvicorn backend.main:app ...`
- Requires `backend/` to be a package (e.g. `backend/__init__.py`)

Recommendation: **Option A** — deploy `backend/` contents to `/opt/gambitron/backend`, run from there.
