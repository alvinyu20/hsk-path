# Friends board server (Cloudflare Worker + D1)

A tiny server so you and your friends can see each other's study totals. It is **optional**: until you put its address in `config.js`, the Friends tab stays hidden and the site works exactly as before.

**What it stores** (per person): a first name, a few totals shown to the group (minutes studied each of the last 7 days, streak, words in memory, level, exam passes), and a private copy of that person's own study progress (words, exam passes, minutes) plus their own settings and notes (listening level, what the AI chat remembers about them, chat preferences, and API keys only if that person switches key sharing on), so every device of the same person shows the same thing. Friends can see only the totals, never the progress copy. You, as the owner, could read it in the database console, so only invite people you trust. The server throws away anything it does not recognise in the totals.

**How people get in, without accounts or passwords:** joining is open: you send each friend the plain site address, they type their first name, done. The app keeps a secret key on their device (the server stores only a hash of it). To use a second device, they copy "their link" from the Friends screen and open it there.

**Cost:** free. Cloudflare's free plan (no credit card needed) is far above what 5 friends use: about 500 requests a day against a limit of 100,000.

## Set it up in the Cloudflare dashboard (no terminal)

Menu names change now and then; look for the closest match.

1. Make a free account at <https://dash.cloudflare.com>.
2. **Workers & Pages → Create → Start with Hello World**. Name it `shanlu-friends` and deploy. Then **Edit code**, delete everything there, paste the whole of [`worker.js`](worker.js), and **Deploy**.
3. **Storage & Databases → D1 → Create database**, name `shanlu-friends`. (The tables are created automatically the first time the server runs.)
4. Open your Worker → **Settings → Bindings → Add → D1 database**. The variable name must be exactly `DB`. Pick `shanlu-friends`.
5. Same Settings page → **Variables and Secrets**. Add these (type **Secret** for `ADMIN_KEY`). Do **not** add `INVITE_CODE`: joining is open, so anyone who opens the site can join with a first name:

   | Name | Value |
   |---|---|
   | `ADMIN_KEY` | a long random string (32+ characters) |
   | `GROUP_NAME` | what the group is called, for example `Shanlu crew` |
   | `ALLOWED_ORIGINS` | `https://alvinyu20.github.io` (the site's address, no slash at the end, no path) |
   | `MAX_MEMBERS` | optional; default is 12. Raise it (for example `40`) if more people will join |

   Deploy again after changing variables.
6. Open `https://<your-worker>.<your-subdomain>.workers.dev/api/health` in a browser. You should see `{"ok":true}`.
7. Put that address (without `/api/health`) in [`config.js`](../config.js):

   ```js
   window.SHANLU_FRIENDS_URL = 'https://shanlu-friends.your-subdomain.workers.dev';
   ```

   Commit and push. After the site updates, the Friends tab appears.
8. Send each friend the plain site address, `https://alvinyu20.github.io/hsk-path/`. On their first visit they are asked for a first name and whether to join the study group (or they can join later from Friends). There are no invite links any more.

## Updating a Worker you already set up

Whenever `worker.js` changes, paste the whole new file over the old one (**Edit code**) and **Deploy**. Nothing else changes: the variables, the database and everyone's links stay.

**Moving to open joining (the site's join form no longer asks for an invite code):** after pasting the new `worker.js`, delete the `INVITE_CODE` secret (Settings → Variables and Secrets). While `INVITE_CODE` is still set, the site's join form is refused with "closed to new people". Open joining is limited to 20 joins an hour per network address and 200 an hour for the whole server, and the group stops at `MAX_MEMBERS`.

Earlier versions added:

- **Single-use invite codes** (only used if you set `INVITE_CODE` to close the group). `curl -X POST -H "X-Admin-Key: <your ADMIN_KEY>" https://<your-worker>.workers.dev/api/admin/invites` answers `{"code":"ABCD-EFGH-JKLM","valid_days":7}`. Send that person `https://alvinyu20.github.io/hsk-path/#join=ABCD-EFGH-JKLM`. The code works once and for 7 days, so a forwarded or leaked link is useless after the friend has joined. `INVITE_CODE` still works as before (it is the shared code for the whole group); delete it once everyone is in if you only want single-use codes.
- **A brake on guessing.** Wrong codes are limited to 8 an hour per network address and 60 an hour for the whole server (answer `slow_down` / HTTP 429). Joining is also atomic, so many people racing for the last seat cannot go over `MAX_MEMBERS`.
- **Checked saves.** A progress save must be real JSON of the expected shape and not too big (about 400,000 characters plain, or a compressed copy that unpacks to the same). The app adds `?base=<version>` so that if your other device saved in between, the server answers 412 (`conflict`) and the app merges again instead of overwriting.
- **Compressed saves.** The app sends large progress copies gzip-compressed (`{"v":2,"gz":"..."}`). An older Worker answers 400 to that and the app falls back to the plain form by itself, so updating the site first is safe; update the Worker to get the smaller, faster saves.
- A Cloudflare **rate-limiting rule** (Security → WAF → Rate limiting rules, free plan: 1 rule) in front of the Worker, for example 100 requests per minute per address, is a good extra brake. It is a dashboard setting and is not part of this repository.

**In the app:** Friends → *Test connection* checks that this browser can reach the server and that it still accepts this device. If it says the server may not allow this site, `ALLOWED_ORIGINS` must be exactly the address in the browser's address bar, with no slash and no path (for example `https://alvinyu20.github.io`).

## Day to day

- **Remove someone, or see who is in:** in the dashboard open the D1 database → **Console** and run `SELECT id, name FROM members;` then `DELETE FROM cheers WHERE from_id = '<id>' OR to_id = '<id>'; DELETE FROM progress WHERE member_id = '<id>'; DELETE FROM members WHERE id = '<id>';`. (Or call `GET /api/admin/members` and `DELETE /api/admin/members/<id>` with the header `X-Admin-Key: <your ADMIN_KEY>`.) A removed person's device is signed out at its next sync.
- **Stop new people joining:** set `INVITE_CODE` to any long random value (people already in are not affected; the site's join form will then say the group is closed). Delete it again to reopen joining.
- **If someone loses their link:** they can join again from Friends with their name; you can remove their old entry.
- **Free limits:** if a daily limit were ever hit, the Friends tab shows an error until the reset (00:00 UTC). The rest of the app keeps working, because everyone's progress also lives on their own device.

## Set it up with the terminal instead

```sh
cd worker
npm install
npx wrangler login
npx wrangler d1 create shanlu-friends            # copy the database_id it prints into wrangler.toml
npx wrangler secret put ADMIN_KEY
npx wrangler deploy
```

Fill in `wrangler.toml` (copy `wrangler.example.toml`) first.

## Tests

`cd worker && npm install && node test.mjs` runs this exact `worker.js` against a real local D1 database (checks, conflicts, the guessing brake, single-use codes, racing joins). `node tools/smoke-test-friends.js` (from the repo root) clicks through the whole feature in a browser with several friends. All of these also run on every push (see `.github/workflows/ci.yml`).

## Notes on safety

- Joining is open, so the brakes on strangers are the hourly join limits, `MAX_MEMBERS`, and your ability to remove anyone (`ADMIN_KEY`). If a stranger ever joins, remove them and set `INVITE_CODE` to close the group. (If you do set an `INVITE_CODE`, it is checked once, in constant time; make it long and random.)
- A key is 192 random bits and is stored only as a SHA-256 hash. Treat "your link" like a password. It lives after the `#` in the address, which browsers never send to the website host.
- The server only answers requests from the sites listed in `ALLOWED_ORIGINS` (browsers enforce this). Requests need the secret key anyway.
- **Other pages under `alvinyu20.github.io` share this site's browser storage.** Browsers keep saved data per address up to the host name, so any other project page you publish at `alvinyu20.github.io/<something>` runs in the same space as Shanlu and could read the saved progress, API keys and friend key on a device. That is fine while every page there is yours. If you ever host something you do not fully control on that host, first move Shanlu to its own address (a custom domain, or a Cloudflare Pages project) and change `ALLOWED_ORIGINS` to match. Until then, the site's security policy (written into `index.html` by `tools/build-site.js`) keeps Shanlu's own pages from loading code from anywhere else, and API keys can be kept on every device only if you set a passphrase (they are stored encrypted).
- The server has not been tried on Cloudflare itself from the place it was written; it was tested against Cloudflare's own local runtime (workerd) and a local D1 database. Do the first real test with one friend before inviting everyone.
