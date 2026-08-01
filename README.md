# Vehicle Data Service

NestJS service that pulls vehicle data from the [NHTSA vPIC API](https://vpic.nhtsa.dot.gov/api/) (which only speaks XML), converts it to JSON, stores it in MongoDB and exposes it over GraphQL.

## Run it with Docker

Needs Docker with the Compose plugin. Nothing else.

```bash
docker compose up --build
```

That brings up MongoDB and the app on http://localhost:3000/graphql. Open that URL in a browser for the Apollo sandbox.

On the first boot the database is empty, so the app starts ingesting all ~12k makes in the background. It takes a few minutes. To get something usable faster, limit how many makes are ingested:

```bash
INGEST_MAKES_LIMIT=100 docker compose up --build
```

To stop and wipe the data: `docker compose down -v`.

## Run it locally

You need:

- Node.js 20 or newer (`node -v`)
- a MongoDB instance — easiest is `docker run -d -p 27017:27017 --name vehicles-db mongo:7`

Then:

```bash
npm install
cp .env.example .env
npm run start:dev
```

`.env` already points at `mongodb://localhost:27017/vehicles`, so if you used the Docker command above it works as is. Set `INGEST_MAKES_LIMIT=100` in `.env` if you don't want to wait for the full ingestion.

The app logs `GraphQL endpoint ready at http://localhost:3000/graphql` when it's up.

Other commands:

```bash
npm test          # unit + e2e
npm run test:cov  # with coverage
npm run lint
npm run build && npm start   # compile to dist/ and run it
```

The e2e suite uses an in-memory repository and a stubbed data source, so tests need no MongoDB and no network.

## Querying

Everything goes through `POST /graphql`. Some examples to paste into the sandbox:

```graphql
query MakesPage {
  makes(limit: 5, offset: 0) {
    makeId
    makeName
    vehicleTypes {
      typeId
      typeName
    }
  }
}

query AstonMartin {
  make(makeId: 440) {
    makeName
    vehicleTypes { typeName }
  }
}

mutation Reingest {
  ingestVehicleData {
    makesIngested
    makesFailed
    durationMs
  }
}
```

Or with curl:

```bash
curl -s http://localhost:3000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ makes(limit: 2) { makeId makeName vehicleTypes { typeId typeName } } }"}'
```

The full schema is `makes(limit, offset)`, `make(makeId)`, `makesCount` and the `ingestVehicleData` mutation. It's code-first and every field has a description, so introspection in the sandbox is the source of truth.

## Configuration

Env vars are validated with Joi at startup — bad config fails the boot with a clear message instead of blowing up later. Defaults are in [`src/infra/env/env.ts`](src/infra/env/env.ts). A `.env` file is read locally; real env vars always win.

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `test` \| `production`. Controls pretty vs JSON logs. |
| `PORT` | `3000` | HTTP port. |
| `LOG_LEVEL` | `info` | Pino level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. |
| `MONGODB_URI` | `mongodb://localhost:27017/vehicles` | MongoDB connection string. |
| `NHTSA_API_BASE_URL` | `https://vpic.nhtsa.dot.gov/api/vehicles` | External API base URL. |
| `NHTSA_TIMEOUT_MS` | `10000` | Per-request timeout for NHTSA calls. |
| `NHTSA_MAX_RETRIES` | `3` | Retries per request after the first attempt. |
| `NHTSA_RETRY_DELAY_MS` | `500` | Base backoff delay, doubled on each retry. |
| `NHTSA_CONCURRENCY` | `10` | Parallel vehicle-type requests during ingestion (1–50). |
| `INGEST_MAKES_LIMIT` | `0` | Cap on ingested makes; `0` means all. |

## How ingestion works

One `GET /getallmakes?format=XML` gives the list of makes. Then one `GetVehicleTypesForMakeId/:id` call per make. A pool of `NHTSA_CONCURRENCY` workers pulls from a shared cursor, so that many requests stay in flight without hammering the API. Every 500 makes the buffer is flushed to Mongo with `bulkWrite` upserts, so a crash halfway through keeps everything fetched so far and a re-run just fills the gap.

It runs daily at 2am (server time, via `@nestjs/schedule`) and on demand via the `ingestVehicleData` mutation. Both go through the same use case. A second run while one is in flight is rejected with an `extensions.code` of `CONFLICT` (GraphQL still answers HTTP 200).

Failure handling:

- Requests time out via `AbortSignal.timeout` and retry with exponential backoff plus jitter. Only 5xx, 408, 425 and 429 are retried — a 404 fails immediately instead of burning the whole retry budget.
- XML is validated before parsing. Missing structure, non-numeric ids or empty names throw a `TransformationError` with context.
- A `Results` block that exists but has none of the expected entries is treated as a broken upstream contract, not as "no data" — otherwise a renamed tag would look like a successful ingestion of zero makes.
- A make whose vehicle types can't be fetched is logged, skipped and counted in `makesFailed`. The run keeps going.
- A Mongo error stops the run and surfaces to the caller. Batches already written stay; upserts are idempotent, so a re-run repairs the rest.

Logs are structured JSON via Pino, pretty-printed in development. Ingestion logs progress every 1000 makes plus a final summary.

## Data model

One collection, `vehicle_makes`, one document per make:

```json
{
  "makeId": 440,
  "makeName": "ASTON MARTIN",
  "vehicleTypes": [
    { "typeId": 2, "typeName": "Passenger Car" },
    { "typeId": 7, "typeName": "Multipurpose Passenger Vehicle (MPV)" }
  ]
}
```

`makeId` is uniquely indexed and used as the upsert key. Vehicle types are embedded because nothing ever reads them without the make.

## Layout

Clean-architecture folders

```
src/
  core/utils/               shared helpers (chunk)
  domain/vehicles/
    enterprise/entities/    VehicleMake, VehicleType
    application/
      gateways/             VehicleDataSource port
      repositories/         VehicleMakeRepository port
      use-cases/            ingest-vehicle-data, list-makes, get-make, count-makes
  infra/
    env/                    env schema + Joi validation
    database/               Mongoose schema and repository
    nhtsa/                  HTTP client and XML→JSON transformer
    ingestion/              scheduled ingestion trigger
    http/                   GraphQL types and resolver
    app.module.ts           wiring
    main.ts                 bootstrap
test/
  repositories/             in-memory repository for e2e
  app.e2e-spec.ts
```

The domain reaches the outside world only through ports — data source, repository, logger — and infra implements them and wires everything with Nest DI. That is what makes the tests easy to isolate. Framework lifecycle stays in infra: `ScheduledIngestionService` decides when to ingest, the use case just ingests.

## CI

[GitHub Actions](.github/workflows/ci.yml) runs lint, tests with coverage, the TypeScript build and a Docker build on every push and PR.
