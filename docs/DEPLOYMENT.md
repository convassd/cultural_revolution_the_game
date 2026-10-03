# Publish v0.0 to GitHub Pages

Target repository: [convassd/cultural_revolution_the_game](https://github.com/convassd/cultural_revolution_the_game)

Website: [https://convassd.github.io/cultural_revolution_the_game/](https://convassd.github.io/cultural_revolution_the_game/)

The website URL follows the account/repository naming scheme, but becomes usable only after Pages is enabled and deployment succeeds.

## How this works

GitHub stores the source code. GitHub Actions runs the project's tests and Vite build. GitHub Pages serves the resulting static files. Visitors open the website URL and play in their browsers without cloning or installing the project.

A normal project repository uses `https://USERNAME.github.io/REPOSITORY/`. A specially named `USERNAME.github.io` repository can instead use the account's root URL. This project uses the normal repository form; no separate root website repository is needed.

## 1. Create an empty repository

Sign in as `convassd` and open [New repository](https://github.com/new?owner=convassd&name=cultural_revolution_the_game&visibility=public).

- Owner: `convassd`.
- Repository name: `cultural_revolution_the_game`.
- Visibility: **Public**, so the free GitHub Pages option can be used.
- Suggested description: `A browser-based character card duel with hot-seat and local AI modes.`
- Leave automatic README, .gitignore and license initialization unchecked. The local project already contains its release files.

Create the repository. If it already exists with commits, do not follow the empty-repository push commands below blindly; inspect its contents first.

## 2. Commit and push the prepared project

Open a terminal in the local project directory. It already has a Git repository with `main` as its branch, so no new `git init` is needed.

First review what will be committed:

```sh
git status --short
git ls-files --others --exclude-standard
```

EPUB/PDF books, `artifacts/`, generated report JSON, `node_modules/`, `dist/`, local environment overrides and editor state should be absent from the candidate list. Source, tests, SVG portraits, English documentation, workflow and `package-lock.json` should remain.

If Git has no author identity configured, set a local identity before committing. Use your preferred display name and the exact private commit email shown in GitHub **Settings → Emails**; no account password is involved in these two settings.

```sh
git config user.name "convassd"
git config user.email "YOUR_GITHUB_NOREPLY_EMAIL"
```

Replace the email placeholder; do not run that line unchanged. Then:

```sh
git add .
git diff --cached --stat
git commit -m "Release v0.0 browser prototype"
git remote add origin https://github.com/convassd/cultural_revolution_the_game.git
git push -u origin main
```

If an `origin` remote already exists, inspect `git remote -v` rather than adding a duplicate or replacing it automatically. Authentication is separate from commit identity: follow Git's browser sign-in if prompted. A GitHub account password is not used as an HTTPS Git password. Do not paste access tokens into source files, remote URLs or chat.

## 3. Enable Pages

After the first push, open the repository's **Settings → Pages**. Under **Build and deployment**, change **Source** to **GitHub Actions**.

Open **Actions → Verify and deploy GitHub Pages**. If the first run happened before Pages was enabled and failed, choose **Run workflow** on `main`, or rerun it after correcting the setting.

The workflow performs:

1. `npm ci` with Node.js 22.
2. `npm test`.
3. `npm run build`, which includes typechecking.
4. Upload of `dist/` and deployment to the `github-pages` environment.

Pushes to `main` deploy; pull requests only verify. All Actions are pinned to commit IDs. The workflow uses GitHub's built-in token, so no deployment token needs to be created or saved.

When deployment succeeds, open the website with its trailing slash. The repository README's **Click to play it now** link points to that address. You can also put the website URL in the repository's **About** section.

## 4. Publish the v0.0 release

On GitHub, open **Releases → Draft a new release**:

- Tag: create `v0.0`, targeting the verified `main` commit.
- Title: `Wen Ge Sha v0.0`.
- Description: copy [RELEASE-v0.0.md](RELEASE-v0.0.md).
- Select **This is a pre-release**, since this is an initial playable prototype.
- Publish when ready.

The release tag records the v0.0 source. Pages continues to serve the latest successfully deployed `main` build; a release tag alone does not change the website. There is no need to upload `node_modules/` or commit `dist/`.

## Verify the published site

Open the online link in a fresh browser window. Check the gallery and several portraits, start both game modes, play cards, resolve an entry target, attack, end a turn, and check restart/exit. Confirm final result animation and sound in a completed match.

If Pages returns 404, check **Settings → Pages**, the deployment run and its published URL. If images or scripts fail, keep the repository subdirectory and the `assets/` / `portraits/` layout intact. A stale page can be refreshed without modifying game rules.

## Official references

- [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Creating a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
- [Custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Vite static deployment](https://vite.dev/guide/static-deploy.html#github-pages)
- [Managing releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
