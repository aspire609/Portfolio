# Keith Bandiola Portfolio

Full-stack portfolio with a 3D look (midnight purple to cyan). No npm packages needed, only Node.js 18+.

```
portfolio/
  server.js          Node.js backend: serves the site, JSON API, uploads, owner login, robots.txt, sitemap.xml
  public/index.html  Page structure and SEO tags
  public/style.css   Styles and 3D effects
  public/script.js   Frontend logic, 3D background, tilt cards
  data/              Created on first run: db.json and uploads/
```

## Run locally
```
cp .env.example .env     # then set ADMIN_PASSWORD
node server.js
```
Open http://localhost:3000. Click "Owner login" in the footer, log in, and edit everything in the page.

## Put it online so anyone can find it
1. Push this folder to a GitHub repository (do not commit `.env` or `data/`).
2. Deploy to a Node host such as Render, Railway or Fly.io. Start command: `node server.js`.
3. Set environment variables: `ADMIN_PASSWORD`, `SITE_URL` (your final https address).
4. Attach a persistent disk and set `DATA_DIR` to its path, otherwise uploads and edits are lost on redeploy.
5. Optional: buy a domain (for example keithbandiola.com) and point it at the host.

## Show up on Google
1. Open https://search.google.com/search-console and add your site URL.
2. Submit `https://your-domain/sitemap.xml`, then use "Request indexing" on the home page.
3. Indexing takes days to weeks. Using your full name in the page title, headline and About text (already set up) helps people find you by name. Link to the site from your GitHub, Facebook and LinkedIn profiles.

## Notes
- Visitors can only read. Editing needs the owner password and a session cookie.
- The old "design folder live preview" feature was removed because a public site should not run uploaded code. Link live demos in a project's Links field instead.
