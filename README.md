# Sandboxx Lock

Keypad lock and web app for Sandboxx. Users ask for access with a reason, a SuperUser of their club approves, and the user gets a 6-digit PIN for the door that is valid for 12 hours. The ESP32 lock checks every PIN with the server and every attempt is logged.

## Requirements

- [Bun](https://bun.sh) 1.3+
- Docker Desktop (for Postgres)
- Arduino IDE 2 (for the lock)

## Database setup

1. Copy the env file and fill in `JWT_SECRET` and `LOCK_API_KEY` (any random string of 32+ characters).
   ```bash
   cp .env.example .env
   ```
2. Start Postgres.
   ```bash
   docker compose --profile dev up -d db
   ```
3. Create the tables.
   ```bash
   bun run db:migrate
   ```
4. Create the first admin. `--demo` also adds a test club, a test SuperUser and a test user.
   ```bash
   bun run db:seed your.email@hyderabad.bits-pilani.ac.in --demo
   ```

## Development

```bash
bun install
bun run dev
```

> [!NOTE]
> Google sign in needs `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` (a Web client from Google Cloud Console with `http://localhost:3000` as an authorised JavaScript origin). Without it, set `DEV_LOGIN=true` and use the dev login box on `/login` with any seeded email.

Emails to SuperUsers are sent only when `EMAIL_USER` and `EMAIL_PASS` (a Gmail app password) are set.

Before committing, these must pass:

```bash
bun run typecheck
bun run lint
bun run build
```

After changing `src/db/schema.ts`, run `bun run db:generate` and commit the new file in `drizzle/`.

## Lock

1. In Arduino IDE, install the "esp32 by Espressif" board package and the ArduinoJson library.
2. Copy `firmware/sandboxx-lock/config.example.h` to `config.h` in the same folder and fill in the WiFi, server URL and `LOCK_API_KEY`.
3. Plug the board into the USB-C port marked COM, pick "ESP32S3 Dev Module" and the COM port, then upload `firmware/sandboxx-lock/sandboxx-lock.ino`.
4. Open the Serial Monitor at 115200 baud, type a PIN and press enter. Green means open, red means wrong PIN or locked out, blue means the server couldn't be reached.

> [!NOTE]
> The ESP32 only sees 2.4 GHz WiFi. When testing with a phone hotspot, turn on "maximise compatibility" (iPhone) or set the AP band to 2.4 GHz (Android).

The lock API can also be tested without the board:

```bash
curl -X POST http://localhost:3000/api/lock/verify -H "Authorization: Bearer <LOCK_API_KEY>" -H "Content-Type: application/json" -d '{"pin":"123456"}'
```
