# Estágio 1: Build do Frontend (Vite)
FROM node:18-alpine as build

WORKDIR /app

# Copiar os arquivos e instalar dependências
COPY package*.json ./
RUN npm install

# Copiar o resto do código
COPY . .

# Fazer o build de produção do Vite
RUN npm run build

# Estágio 2: Nginx para servir o frontend e fazer o proxy reverso da API
FROM nginx:alpine

# Copiar os arquivos gerados no build para o Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Substituir a configuração padrão do Nginx pela nossa (para funcionar o Proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
