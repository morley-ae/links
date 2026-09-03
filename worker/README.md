# EndlessAudios download counter

This Worker stores one row per audio in the `endlessaudios-stats` D1 database.

## Cloudflare dashboard deployment

1. Open Worker `endlessaudios-counter` in Cloudflare.
2. Open **Edit code** and replace the source with `src/index.js`.
3. Confirm the D1 binding is named `DB` and points to `endlessaudios-stats`.
4. Open the D1 database and run `schema.sql` once.
5. Deploy the Worker.

The frontend expects these routes:

- `GET /downloads` returns all audio counts and the total.
- `POST /downloads` with `{ "filename": "path/to/audio.mp3" }` increments one audio.

The Worker automatically creates a row for a filename on its first download.

## Wrangler deployment

Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.toml` with the ID shown in the D1 database settings, then run:

```sh
npx wrangler d1 execute endlessaudios-stats --remote --file=schema.sql
npx wrangler deploy
```
