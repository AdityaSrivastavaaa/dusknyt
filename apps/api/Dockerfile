# Build from the repo root:  docker build -f apps/api/Dockerfile -t dusknyt-api .
FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm install -w @dusknyt/api -w @dusknyt/shared --include-workspace-root=false
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "@dusknyt/api"]
