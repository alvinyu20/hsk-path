# Friends board server (Cloudflare Worker + D1)

A tiny server so you and your friends can see each other's study totals. It is **optional**: until you put its address in `config.js`, the Friends tab stays hidden and the site works exactly as before.

**What it stores** (per person): a first name and a few totals (minutes studied each of the last 7 days, streak, words in memory, level, exam passes). **Never** word lists or anything else; the server throws away anything else it is sent.

**How people get in, without accounts or passwords:** you send each friend an invite link. They open it, type their first name, done. The app keeps a secret key on their device (the server stores only a hash of it). To use a second device, they copy "their link" from the Friends screen and open it there.

**Cost:** free. Cloudflare's free plan (no credit card needed) is far above what 5 friends use: about 500 requests a day against a limit of 100,000.

## Set it up in the Cloudflare dashboard (no terminal)

Menu names change now and then; look for the closest match.

1. Make a free account at <https://dash.cloudflare.com>.
2. **Workers & Pages → Create → Start with Hello World**. Name it `shanlu-friends` and deploy. Then **Edit code**, delete everything there, paste the whole of [`worker.js`](worker.js), and **Deploy**.
3. **Storage & Databases → D1 → Create database**, name `shanlu-friends`. (The tables are created automatically the first time the server runs.)
4. Open your Worker → **Settings → Bindings → Add → D1 database**. The variable name must be exactly `DB`. Pick `shanlu-friends`.
5. Same Settings page → **Variables and Secrets**. Add these (type **Secret** for the first two):

   | Name | Value |
   |---|---|
   | `INVITE_CODE` | 12 or more random letters and numbers, for example `K7QM-2XVD-9RTB` |
   | `ADMIN_KEY` | a long random string (32+ characters) |
   | `GROUP_NAME` | what the group is called, for example `Shanlu crew` |
   | `ALLOWED_ORIGINS` | `https://alvinyu20.github.io` (the site's address, no slash at the end, no path) |
   | `MAX_MEMBERS` | optional; default is 12 |

   Deploy again after changing variables.
6. Open `https://<your-worker>.<your-subdomain>.workers.dev/api/health` in a browser. You should see `{"ok":true}`.
7. Put that address (without `/api/health`) in [`config.js`](../config.js):

   ```js
   window.SHANLU_FRIENDS_URL = 'https://shanlu-friends.your-subdomain.workers.dev';
   ```

   Commit and push. After the site updates, the Friends tab appears.
8. Send each friend this link (the part after `#join=` is your `INVITE_CODE`):

   `https://alvinyu20.github.io/hsk-path/#join=K7QM-2XVD-9RTB`

## Day to day

- **Remove someone, or see who is in:** in the dashboard open the D1 database → **Console** and run `SELECT id, name FROM members;` then `DELETE FROM cheers WHERE from_id = '<id>' OR to_id = '<id>'; DELETE FROM members WHERE id = '<id>';`. (Or call `GET /api/admin/members` and `DELETE /api/admin/members/<id>` with the header `X-Admin-Key: <your ADMIN_KEY>`.) A removed person's device is signed out at its next sync.
- **Stop new people joining:** change `INVITE_CODE` (people already in are not affected), or delete the variable to switch joining off.
- **If someone loses their link:** they join again with the invite link; you can remove their old entry.
- **Free limits:** if a daily limit were ever hit, the Friends tab shows an error until the reset (00:00 UTC). The rest of the app keeps working, because everyone's progress lives on their own device.

## Set it up with the terminal instead

```sh
cd worker
npm install
npx wrangler login
npx wrangler d1 create shanlu-friends            # copy the database_id it prints into wrangler.toml
npx wrangler secret put INVITE_CODE
npx wrangler secret put ADMIN_KEY
npx wrangler deploy
```

Fill in `wrangler.toml` (copy `wrangler.example.toml`) first.

## Tests

`cd worker && npm install && node test.mjs` runs this exact `worker.js` against a real local D1 database. `node tools/smoke-test-friends.js` (from the repo root) clicks through the whole feature in a browser with several friends.

## Notes on safety

- The invite code is checked once, in constant time. Make it long and random: the member limit is the only other brake on strangers joining.
- A key is 192 random bits and is stored only as a SHA-256 hash. Treat "your link" like a password. It lives after the `#` in the address, which browsers never send to the website host.
- The server only answers requests from the sites listed in `ALLOWED_ORIGINS` (browsers enforce this). Requests need the secret key anyway.
- The server has not been tried on Cloudflare itself from the place it was written; it was tested against Cloudflare's own local runtime (workerd) and a local D1 database. Do the first real test with one friend before inviting everyone.
