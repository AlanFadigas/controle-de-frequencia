# Backend de Gestão de Frequência

Este é o backend oficial do sistema de Ponto, construído com **Node.js, Express e Prisma ORM**.
Ele substitui a solução temporária do `json-server` e gerencia a autenticação de forma segura utilizando JWT.

## Pré-requisitos
- Node.js (versão >= 18)
- NPM ou Yarn

## Instalação e Execução

### 1. Instalar as dependências
Navegue até esta pasta (`backend/`) pelo terminal e rode:
```bash
npm install
```

### 2. Sincronizar o Banco de Dados
O sistema atualmente utiliza um banco de dados **SQLite** armazenado no arquivo `prisma/dev.db`.
Para criar as tabelas no banco de dados, execute:
```bash
npx prisma db push
```

### 3. Iniciar o Servidor
Para rodar o servidor em ambiente de desenvolvimento (com auto-restart):
```bash
npm run dev
```
O servidor irá rodar na porta `3333` (http://localhost:3333).

## Visualizar e Editar o Banco de Dados Diretamente
Como estamos utilizando o Prisma, você não precisa de um programa complexo como o DBeaver para ver as tabelas agora. O Prisma possui uma interface web nativa!

Basta rodar no terminal (dentro da pasta backend):
```bash
npx prisma studio
```
Ele abrirá uma página no seu navegador (`http://localhost:5555`) onde você pode ver e editar todos os **Usuários** e **Logs** de forma visual.

## Mudando para PostgreSQL no Docker
Quando for criar a imagem Docker para produção, tudo que você precisa fazer é:
1. Abrir o arquivo `prisma/schema.prisma`.
2. Mudar o `provider = "sqlite"` para `provider = "postgresql"`.
3. Adicionar a URL do seu banco Postgres.
4. Rodar `npx prisma db push` novamente.
O código Express não precisa de nenhuma modificação!
