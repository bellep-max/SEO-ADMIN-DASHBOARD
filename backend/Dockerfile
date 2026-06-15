# Backend API image for AWS App Runner.
# The esbuild bundle in dist/ is fully self-contained (pure-JS deps), so we only
# need a Node runtime plus the built artifacts — no node_modules install.
FROM node:24-alpine

WORKDIR /app

# Built by `node build.mjs` before docker build (dist/index.mjs + pino workers).
COPY dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
