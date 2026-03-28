FROM node:18-slim AS build

WORKDIR /app

COPY package.json ./
RUN yarn install

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN yarn build

FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

RUN printf 'server {\n    listen 3000 default_server;\n    root /usr/share/nginx/html;\n    index index.html;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD sh -c "sed -i \"s/listen 3000/listen $PORT/\" /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
