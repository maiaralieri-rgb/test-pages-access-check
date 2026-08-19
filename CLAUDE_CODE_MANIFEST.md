# Manifesto do pacote AssinaFluxo

## Incluído

O pacote inclui o código Expo/React Native e web em `app/`, `components/`, `hooks/`, `lib/`, `server/`, `shared/` e `constants/`; os testes em `tests/`; as migrações e o schema em `drizzle/`; o formulário original em `assets/forms/PM-COM-002.pdf`; os ícones em `assets/images/`; os scripts em `scripts/`; e as configurações `package.json`, `pnpm-lock.yaml`, `app.config.ts`, `metro.config.js`, `theme.config.js`, `tailwind.config.js` e `tsconfig.json`.

A documentação incluída é `CLAUDE_CODE_HANDOFF.md`, `auth_design.md`, `design.md`, `research_certificacao.md`, `roteiro_implantacao.md` e `todo.md`. O arquivo de transferência contém o mapa das telas, comandos, segredos por nome, arquitetura atual, testes, roteiro de continuidade e limitações conhecidas.

## Excluído propositalmente

`node_modules/`, `.git/`, `.manus-logs/`, `.expo/`, `dist/`, arquivos `.env`, caches, sessões, tokens, credenciais, prévias geradas e arquivos de inspeção temporários não devem ser enviados ao Claude Code. O objetivo é entregar código reproduzível e documentação, não dados de ambiente ou segredos.

## Como usar o ZIP

Depois de extrair o arquivo, entre na pasta do projeto, execute `pnpm install`, configure `ASSINAFLUXO_REGISTRATION_CODE` no ambiente do servidor, aplique as migrações conforme o banco de destino, rode `pnpm check`, `pnpm lint` e `pnpm test`, e só então inicie com `pnpm dev`.
