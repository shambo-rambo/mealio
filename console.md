simonhamblin@Simons-MacBook-Air server % npx wrangler d1 migrations apply mealio --remote 

 ⛅️ wrangler 3.114.17 (update available 4.80.0)
---------------------------------------------------------

▲ [WARNING] The version of Wrangler you are using is now out-of-date.

  Please update to the latest version to prevent critical errors.
  Run `npm install --save-dev wrangler@4` to update to the latest version.
  After installation, run Wrangler with `npx wrangler`.


Migrations to be applied:
┌─────────────────────────┐
│ name                    │
├─────────────────────────┤
│ 0000_spicy_hairball.sql │
└─────────────────────────┘
✔ About to apply 1 migration(s)
Your database may not be available to serve requests during the migration, continue? … yes

🌀 Executing on remote database mealio (e0dec412-0471-46cd-bc86-b9b7070d6924):
🌀 To execute on your local development database, remove the --remote flag from your wrangler command.
🚣 Executed 23 commands in 5.38ms
┌─────────────────────────┬────────┐
│ name                    │ status │
├─────────────────────────┼────────┤
│ 0000_spicy_hairball.sql │ ✅     │
└─────────────────────────┴────────┘
simonhamblin@Simons-MacBook-Air server % 
simonhamblin@Simons-MacBook-Air server % npm run deploy   

> mealio-server@1.0.0 deploy
> wrangler deploy


Cloudflare collects anonymous telemetry about your usage of Wrangler. Learn more at https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler/telemetry.md

 ⛅️ wrangler 3.114.17 (update available 4.80.0)
---------------------------------------------------------

▲ [WARNING] The version of Wrangler you are using is now out-of-date.

  Please update to the latest version to prevent critical errors.
  Run `npm install --save-dev wrangler@4` to update to the latest version.
  After installation, run Wrangler with `npx wrangler`.


Total Upload: 955.62 KiB / gzip: 179.55 KiB
Your worker has access to the following bindings:
- Durable Objects:
  - FAMILY_ROOM: FamilyRoom
- D1 Databases:
  - DB: mealio (e0dec412-0471-46cd-bc86-b9b7070d6924)
- R2 Buckets:
  - R2: mealio-uploads
- Vars:
  - APP_URL: "http://localhost:5173"

✘ [ERROR] A request to the Cloudflare API (/accounts/28f86d3ff505125875439e76db6067dc/workers/scripts/mealio-api) failed.

  R2 bucket 'mealio-uploads' not found. Verify the bucket exists in your account and that the
  bucket_name in your configuration is correct. [code: 10085]
  To learn more about this error, visit: https://developers.cloudflare.com/r2/get-started/

  
  If you think this is a bug, please open an issue at:
  https://github.com/cloudflare/workers-sdk/issues/new/choose


🪵  Logs were written to "/Users/simonhamblin/Library/Preferences/.wrangler/logs/wrangler-2026-04-07_01-13-30_535.log"
npm error Lifecycle script `deploy` failed with error:
npm error code 1
npm error path /Users/simonhamblin/mealio/server
npm error workspace mealio-server@1.0.0
npm error location /Users/simonhamblin/mealio/server
npm error command failed
npm error command sh -c wrangler deploy
simonhamblin@Simons-MacBook-Air server % 