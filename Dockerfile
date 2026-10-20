# ---- Build stage -------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src
# Same-origin by default: nginx proxies /api and /ws to the backend.
ARG VITE_API_URL=/api/v1
ARG VITE_WS_URL=
ARG VITE_DATA_SOURCE=auto
ENV VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL VITE_DATA_SOURCE=$VITE_DATA_SOURCE
RUN npm run test && npm run build

# ---- Runtime stage -----------------------------------------------------------------------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
