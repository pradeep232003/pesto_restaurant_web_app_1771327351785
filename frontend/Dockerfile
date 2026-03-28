FROM node:18-slim AS build

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN yarn build

FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV NGINX_ENVSUBST_FILTER=^(PORT|BACKEND_URL)$
ENV PORT=3000
ENV BACKEND_URL=http://localhost:8001

CMD ["nginx", "-g", "daemon off;"]
