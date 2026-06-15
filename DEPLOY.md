# Deployment — AWS (account 788269087294, us-east-1)

AWS CLI profile: `aeo-admin`. Pattern mirrors the existing `aeo-admin-api` stack:
SPA on S3+CloudFront, backend on App Runner from ECR, Postgres on RDS (private).

## Backend (DEPLOYED ✅)

| Resource | Value |
|---|---|
| App Runner service | `seo-admin-api` |
| **Live API URL** | https://q7kpdvukd2.us-east-1.awsapprunner.com |
| Service ARN | `arn:aws:apprunner:us-east-1:788269087294:service/seo-admin-api/4b75a069bdea4ce69414227b1d46b953` |
| ECR image | `788269087294.dkr.ecr.us-east-1.amazonaws.com/seo-admin-api:latest` |
| Compute | 0.25 vCPU / 0.5 GB |
| Egress | **DEFAULT (internet)** — required so the backend can call the Serper SERP API |
| RDS | `seo-admin-db` (db.t4g.micro, Postgres 18, encrypted, **publicly accessible**) |
| RDS endpoint | `seo-admin-db.cwvwsawae95c.us-east-1.rds.amazonaws.com:5432` db `seo_admin` |
| VPC | `vpc-009491cd3075225f7` (default) |
| RDS SG | `sg-089f19142951ab074` (ingress 5432 from `0.0.0.0/0` — see security note) |
| Instance role | `seo-apprunner-instance` (reads the 3 secrets) |
| ECR access role | `aeo-apprunner-ecr` (reused) |
| (unused) VPC connector | `seo-vpc-connector` — left in place; only needed if you later add a NAT to make RDS private again |

> **Egress/DB architecture note.** The backend calls the external Serper API, which needs
> internet egress. App Runner egress is all-or-nothing: VPC (private RDS, no internet) **or**
> DEFAULT (internet, but can't reach a private RDS). We chose **DEFAULT egress + publicly
> accessible RDS** (the cheapest option, matching the existing `aeo-admin-api` stack). The DB is
> reachable from the internet on 5432 but protected by **TLS + a 48-char random password**.
> App Runner DEFAULT egress has no fixed IP, so the SG can't be pinned to it (hence `0.0.0.0/0`).
> To make the DB private again, add a NAT (instance ~$3/mo or gateway ~$32/mo), route a private
> subnet through it, recreate the VPC connector there, and switch egress back to VPC.

### Secrets (AWS Secrets Manager)
- `seo-admin/SESSION_SECRET`
- `seo-admin/DATABASE_URL` (includes `?sslmode=no-verify` — connection is TLS-encrypted)
- `seo-admin/SERP_API_KEY` (Serper.dev — powers the geo-grid heatmap + keyword refresh)

### Runtime env (App Runner)
- `NODE_ENV=production`
- `CORS_ORIGINS=https://darked8ds3ew6.cloudfront.net`
- `SERP_PROVIDER=serper`

### ⚠️ App Runner caches the `:latest` tag
`update-service` with an unchanged image identifier may **not** re-pull a freshly pushed image.
After `docker push`, force a fresh pull with:
`aws apprunner start-deployment --service-arn <arn>`

### Admin login
`admin@seolocal.com` (password set out-of-band — not stored in this repo). bcrypt hash in RDS `users`.
To rotate: temporarily re-open RDS to your IP (see "Schema changes" below), `UPDATE users SET password_hash=...`, bump `token_version`, re-lock.

## Redeploy backend after code changes
```bash
export AWS_PROFILE=aeo-admin
cd backend && node build.mjs
docker buildx build --platform linux/amd64 --provenance=false --sbom=false \
  -t 788269087294.dkr.ecr.us-east-1.amazonaws.com/seo-admin-api:latest --push .
aws apprunner start-deployment --service-arn <service-arn>   # AutoDeployments is off
```

## Schema changes (RDS is private)
RDS is not publicly reachable. To run `drizzle-kit push` against it, temporarily add an
ingress rule for your IP on `sg-089f19142951ab074` (and set `--publicly-accessible`), push,
then revert. Preferred long-term: generate Drizzle migrations and apply on container start.

## Frontend (DEPLOYED ✅)

| Resource | Value |
|---|---|
| **Live app URL** | https://darked8ds3ew6.cloudfront.net |
| CloudFront distribution | `EMKUTJ8RMG0MA` |
| S3 bucket (private) | `seo-admin-fe-fcace167` (Block Public Access on; readable only by this distribution via OAC) |
| OAC | `E2SW2YDLJ01N7Q` |
| SPA routing | CloudFront Function `seo-admin-spa-rewrite` (rewrites extensionless, non-`/api` paths to `/index.html`) |
| `/api/*` behavior | proxied to App Runner origin; CachingDisabled + AllViewerExceptHostHeader (forwards Authorization) |
| Price class | PriceClass_100 (cheapest — NA/EU edges) |
| TLS | default `*.cloudfront.net` cert |

App Runner `CORS_ORIGINS` is set to `https://darked8ds3ew6.cloudfront.net`.

### Redeploy frontend after code changes
```bash
export AWS_PROFILE=aeo-admin
cd frontend && PORT=3000 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/seo-admin run build
aws s3 sync dist/public s3://seo-admin-fe-fcace167/ --delete
aws cloudfront create-invalidation --distribution-id EMKUTJ8RMG0MA --paths '/*'
```
