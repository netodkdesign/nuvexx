FROM node:26-slim

ENV AMBIENTE=producao
ENV NODE_ENV=production

WORKDIR /app
COPY package.json server.js waitlist.js ./
COPY public ./public

USER node
EXPOSE 3200
# Direto no node, sem o npm no meio: a página recebe o aviso de desligar e termina o que está gravando.
CMD ["node", "server.js"]
