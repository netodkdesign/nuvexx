FROM node:26-slim

ENV AMBIENTE=producao
ENV NODE_ENV=production

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public

USER node
EXPOSE 3100
# Direto no node, sem o npm no meio: o app recebe o aviso de desligar e fecha o banco com calma.
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
