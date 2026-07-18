# alex-0d18-quick-send-email-for

A minimal one-page web form for sending a real email through the provisioned
Ideavibes email service.

## Run Locally

```bash
npm ci
cp .env.example .env
npm run dev
```

The app listens on `PORT`, defaulting to `8080`.

## Production Build

```bash
npm ci
npm run build
npm start
```

Required runtime environment:

```bash
NODE_ENV=production
PORT=8080
MCTAI_EMAIL_URL=<provisioned send endpoint>
MCTAI_EMAIL_APP_TOKEN=<server-side app token>
```

`MCTAI_EMAIL_APP_TOKEN` must stay server-side. Do not expose it in client
JavaScript or API responses. If `MCTAI_EMAIL_URL` is absent, the send endpoint
returns a stable unconfigured response instead of crashing.

## Docker

```bash
docker build -t alex-0d18-quick-send-email-for .
docker run --rm -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e MCTAI_EMAIL_URL="$MCTAI_EMAIL_URL" \
  -e MCTAI_EMAIL_APP_TOKEN="$MCTAI_EMAIL_APP_TOKEN" \
  alex-0d18-quick-send-email-for
```

Health check endpoint:

```bash
curl http://localhost:8080/api/health
```

The container serves the built React client and Express API from one process.
