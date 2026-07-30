# How to upload the remaining NOOR assets

The AI agent cannot reliably push binary JPGs through this channel. You upload them once; after that the site is complete visually.

## What is still local-only

1. **`assets/manuscripts/`** — ~59 compressed JPG illustrations (one per tile / modal hero)
2. **Full `nodes.js`** — all 58 nodes with long articles (GitHub currently has a 13-node seed)

---

## Option A — GitHub website (easiest, no terminal)

### Images
1. Open https://github.com/Eouchi147/noor
2. Click **Add file** → **Upload files**
3. On your computer, open the project folder the agent has been writing to, then open `assets/manuscripts/`
4. Select **all** `.jpg` files and drag them into the GitHub upload area
5. **Important:** before committing, click the folder path field and type exactly:
   `assets/manuscripts`
   so files land in that folder (not the repo root)
6. Commit message: `Add manuscript tile images`
7. Commit

### Full nodes (optional later)
- You can replace `nodes.js` the same way with the full local `nodes.js` file (or wait for agent text pushes of remaining nodes).

---

## Option B — Git on your Mac (fastest if you use Terminal)

```bash
# 1. Clone once (if you do not already have the repo)
cd ~/Desktop
git clone https://github.com/Eouchi147/noor.git
cd noor

# 2. Copy the manuscript folder from the agent workspace / download
#    (path depends where you saved the artifacts)
mkdir -p assets/manuscripts
cp -R /path/to/your/manuscripts/*.jpg assets/manuscripts/

# 3. Push
git add assets/manuscripts
git commit -m "Add manuscript tile images"
git push origin main
```

Vercel will auto-redeploy if the project is connected to this repo.

---

## Option C — Download a zip from the agent session

If the agent provides a zip of `assets/manuscripts`, download it, unzip, then use Option A or B.

---

## After images are up

Hard-refresh the Vercel site (or open an incognito window). Tiles and modal heroes should show the illuminated manuscript art instead of pure CSS patterns.
