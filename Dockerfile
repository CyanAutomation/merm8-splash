# syntax=docker/dockerfile:1
FROM node:26-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -s /run/secrets/proxy_ca ]; then \
      NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --strict-ssl=true; \
    else \
      npm ci --strict-ssl=true; \
    fi
COPY . .
RUN npm run build

FROM nginx:alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/out /usr/share/nginx/html
COPY --chmod=644 nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R appuser:appgroup /usr/share/nginx/html /var/cache/nginx /run /var/run /var/log/nginx
USER appuser
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
