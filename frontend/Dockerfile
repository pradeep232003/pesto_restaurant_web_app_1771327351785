FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN yarn install && yarn global add serve

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN yarn build

CMD sh -c "serve build -l tcp://0.0.0.0:${PORT:-3000} --single"
