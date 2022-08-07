FROM --platform=linux/amd64 node:16-alpine

WORKDIR /usr/src/app

COPY ["package.json", "yarn.lock", "./"]

RUN yarn install --frozen-lockfile

COPY . .

CMD ["yarn", "start"]
