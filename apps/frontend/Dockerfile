# ── Build Stage ───────────────────────────────────────────────────────────────
FROM node:18-alpine AS build

WORKDIR /app

# Copy dependency manifests and install before copying source so that
# the layer is cached unless package-lock.json changes.
COPY package*.json ./
RUN npm install

# Copy source code (includes .env.production which sets VITE_API_BASE_URL=/api)
COPY . .

# Allow CI to override the env vars via --build-arg without editing the file.
# ARG values are written into .env.production so Vite picks them up at build
# time even when the file already exists with different defaults.
ARG VITE_API_BASE_URL
ARG VITE_WS_URL
RUN if [ -n "$VITE_API_BASE_URL" ]; then \
      echo "VITE_API_BASE_URL=$VITE_API_BASE_URL" > .env.production; \
    fi && \
    if [ -n "$VITE_WS_URL" ]; then \
      echo "VITE_WS_URL=$VITE_WS_URL" >> .env.production; \
    fi

# Build the production bundle (Vite reads .env.production automatically)
RUN npm run build

# ── Production Stage ──────────────────────────────────────────────────────────
FROM nginx:1.25-alpine

# Copy compiled static assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy Nginx config (proxy blocks removed – ALB handles /api and /ws routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
