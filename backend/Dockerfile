FROM node:18-slim

WORKDIR /app

# Instalar openssl para o Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Instalar dependências
COPY package*.json ./
RUN npm install

# Copiar arquivos do backend
COPY . .

# Gerar o Prisma Client
RUN npx prisma generate

# Expor a porta 3333
EXPOSE 3333

# Comando para iniciar o servidor
CMD ["npm", "start"]
