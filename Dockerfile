FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:22-alpine AS ocr-data
ARG TESSDATA_BASE=https://cdn.jsdelivr.net/npm/@tesseract.js-data
WORKDIR /tessdata
RUN wget -qO eng.traineddata.gz "$TESSDATA_BASE/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz" \
    && wget -qO bul.traineddata.gz "$TESSDATA_BASE/bul@1.0.0/4.0.0_best_int/bul.traineddata.gz" \
    && printf '%s\n' \
        "45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91  eng.traineddata.gz" \
        "a38fdba9367316dad1d595427a975756e8c31367fc94a6530d012827833db8d7  bul.traineddata.gz" \
       | sha256sum -c -

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/data && chown app:app /app/data
COPY --from=ocr-data /tessdata ./tessdata
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
