# Gym Log

A personal workout tracker that installs on your iPhone home screen and works offline. Everything is stored on the phone: there are no accounts, no servers, and nothing to pay for.

- [SPEC.md](SPEC.md): the original brief
- [PLAN.md](PLAN.md): how it's built, plus the decisions made along the way
- [PROGRESS.md](PROGRESS.md): what's done and what's next

---

## Put it on your iPhone (free)

There are two parts:
1. Put the app on the web for free with **GitHub Pages**.
2. Add it to your home screen from Safari.

You need a free GitHub account. If you don't have one, sign up at <https://github.com/signup> first.

### 1. Publish with GitHub Pages

Run these in Terminal on your Mac, one at a time.

**a. Install the GitHub command-line tool** (one time):
```bash
brew install gh
```

**b. Log in to GitHub** (one time). Choose **GitHub.com**, then **HTTPS**, then **Login with a web browser**, and follow the prompts:
```bash
gh auth login
```

**c. Create the repository** on GitHub from this folder:
```bash
cd ~/Developer/gym-tracker && gh repo create gym-tracker --public --source=. --remote=origin
```

**d. Turn on GitHub Pages** for it, set to deploy using the included workflow:
```bash
cd ~/Developer/gym-tracker && gh api -X POST "repos/{owner}/{repo}/pages" -f build_type=workflow
```
Or do it on the website: open the repository, go to **Settings → Pages**, and under **Build and deployment → Source** choose **GitHub Actions**.

**e. Upload the code.** This starts the first build:
```bash
cd ~/Developer/gym-tracker && git push -u origin main
```

**f. Wait for the build** (about a minute). This shows its progress:
```bash
cd ~/Developer/gym-tracker && gh run watch
```

Your app is now live at:

**`https://<your-github-username>.github.io/gym-tracker/`**

> **Your workouts stay private.** Free GitHub Pages needs a **public** repository, so the app's *code* is visible to anyone. Your *workouts* never leave your phone.

**Updating later:** after any change, run `git push`. The site rebuilds automatically. The app on your phone picks up the new version the next time you open it; occasionally it takes closing and reopening it twice.

#### Alternative: Vercel

1. Push the code to GitHub (steps a–c and e above).
2. Go to <https://vercel.com>, sign up with your GitHub account, and choose **Add New… → Project**.
3. Import **gym-tracker** and click **Deploy**. Vercel detects that the project uses Vite, so no settings are needed.

You'll get an address like `gym-tracker-xxxx.vercel.app`. Use it in the iPhone steps below.

### 2. Add it to your iPhone home screen

1. On your iPhone, open **Safari**. It must be Safari, not Chrome. Go to your app's address.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**. The name should already say **Gym Log**. Tap **Add**.
4. Open **Gym Log from the home-screen icon**. It opens full screen, like an app.

**Use it only from the home-screen icon.** iOS keeps the icon app's data separate from Safari's. Anything you enter in a normal Safari tab won't show up in the app.

**Check that offline works:** open the app once, switch on Airplane Mode, then close the app fully and reopen it. Everything should still work.

**Make your first backup:**
1. In the app, go to **Settings → Backup & export → Save backup (JSON)**.
2. In the share sheet, choose **Save to Files** and pick iCloud Drive.

This is your safety net if the phone is lost or replaced. The app reminds you if you go 14 days without one.

**Restoring on a new phone:** install the app as above, then go to **Settings → Backup & export → Restore from backup…** and pick the backup file from Files.

You need iOS 16.4 or later.

---

## Working on it (on the Mac)

```bash
cd ~/Developer/gym-tracker && npm install
```

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app at http://localhost:5173. It reloads as you edit. There's no offline mode in dev. |
| `npm test` | Runs the unit tests. |
| `npm run build` | Type-checks, then builds the production version into `dist/`. |
| `npm run preview` | Serves `dist/` at http://localhost:4173, with offline mode on. |
| `npm run check:offline` | After a build: proves the app loads with the server stopped. |
| `npm run check:dod` | After a build: runs the whole Phase 1, Phase 2 and redesign "definition of done" in Chrome (58 checks). |
| `npm run icons` | Regenerates the app icons from `public/icon.svg`. |

Built with Vite, React, TypeScript, vite-plugin-pwa and Dexie (IndexedDB).
