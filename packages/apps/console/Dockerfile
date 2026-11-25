FROM node:22.11.0-bookworm-slim AS build
WORKDIR /workspace
RUN npm install --global pnpm@9.14.2
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @service-foundry/console build
RUN pnpm --filter @service-foundry/console deploy --prod /output

FROM node:22.11.0-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /output/ ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/main.js"]
