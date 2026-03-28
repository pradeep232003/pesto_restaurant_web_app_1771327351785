FROM node:20-slim AS build

WORKDIR /app

COPY package.json ./
RUN yarn install

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN yarn build

FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

RUN echo 'server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

CMD sh -c "sed -i 's/listen 80/listen '${PORT:-80}'/g' /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"
