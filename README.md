# AssinaFluxo — tramitação digital da PM-COM-002 (LMP)

Aplicação web desktop-prioritária para tramitar a planilha **PM-COM-002 / Láurea do Mérito
Pessoal**. Mantém a ordem das etapas, libera a edição apenas do bloco corrente, registra a
manifestação de vontade e as evidências de integridade, e gera o PDF a partir do formulário
original.

## Rodar em 3 comandos

```bash
pnpm install
pnpm env:setup     # gera .env com o código de cadastro (anote o valor exibido)
pnpm dev           # interface em http://localhost:8081 · API em http://localhost:3000
```

Não é preciso instalar banco de dados. Sem `DATABASE_URL`, o app guarda tudo em
`.data/assinafluxo.json`, no próprio servidor — então **todos os signatários conectados
àquele servidor veem o mesmo documento**, que é a propriedade de que a tramitação depende.

Alternativa sem o servidor de desenvolvimento do Expo (mais leve e estável):

```bash
pnpm build:web     # gera dist-web
pnpm start:local   # API + interface já compilada
```

### Primeiro acesso

1. Abra `http://localhost:8081/cadastro`.
2. Informe o **código de cadastro** que o `pnpm env:setup` exibiu.
3. A **primeira conta criada recebe a função de coordenação**; as seguintes entram por
   convite de etapa.

### Chamar os demais signatários

Na tela do processo, a coordenação seleciona a etapa e clica em **Link da etapa**. O sistema
gera um link de uso único com validade. Quem recebe acessa, informa o código de cadastro e
cria a própria senha — e a conta já nasce vinculada àquele processo, etapa, função e posição
na ordem de assinatura.

## Publicar para acesso de todos (link)

O caminho recomendado é o **Firebase**: a interface vai para o Hosting, a API vira uma Cloud
Function e os dados ficam no Firestore. Isso produz um endereço público
(`https://SEU-PROJETO.web.app`) que todos os signatários acessam.

```bash
npx firebase login
npx firebase use --add
pnpm fb:deploy
```

O roteiro completo — criar o projeto, ativar Authentication e Firestore, definir o código de
cadastro e publicar — está em **[DEPLOY_FIREBASE.md](DEPLOY_FIREBASE.md)**.

Alternativa sem Firebase: hospedar o servidor Node você mesmo, com HTTPS, servindo `dist-web`
pelo mesmo domínio da API (ou definindo `EXPO_PUBLIC_API_BASE_URL`), e usar `DATABASE_URL`
com `pnpm db:push` para o banco MySQL.

## Onde os dados ficam

O app escolhe o armazenamento pelo que estiver configurado, sem mudança de código:

| Configuração | Persistência | Identidade |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Firestore | Firebase Auth |
| `DATABASE_URL` | MySQL | Contas locais |
| nenhuma | `.data/assinafluxo.json` | Contas locais |

Em todos os casos o processo vive no servidor, não no navegador: todo signatário autenticado
lê e escreve o mesmo documento, e a interface revalida periodicamente.

Sem sessão válida, o app cai em **modo local**: cada navegador guarda a própria cópia. Esse
modo existe como rede de proteção e fica sinalizado na tela, porque uma planilha assinada em
modo local não chega aos demais participantes.

No modo Firebase o cliente **nunca** escreve no banco. As Security Rules (`firestore.rules`)
negam toda escrita vinda do navegador, de modo que a ordem das assinaturas não pode ser
contornada editando o Firestore direto — isso é verificado por teste, inclusive a tentativa de
forjar assinatura e a de se promover a coordenador.

## Ordem das assinaturas

As dez etapas seguem a sequência do formulário: indicação (Art. 6º), informações pessoais
(P/1), informações disciplinares (PJMD), pareceres de Cmt Cia e Cmt Btl, parecer da
autoridade, situação excepcional, aprovação do Subcomandante, concessão (Art. 8º) e
publicação/remessa. Etapas opcionais podem ser dispensadas; as demais precisam ser assinadas
na ordem.

O servidor não confia na interface. Ao assinar, dentro de uma única transação, ele revalida a
sessão, o vínculo da conta com a função daquela etapa, a conclusão das etapas anteriores, a
manifestação de vontade e a versão do documento; só então grava a evidência, congela o bloco
e libera a etapa seguinte. Uma requisição repetida devolve a assinatura original em vez de
registrar uma segunda.

## Assinatura eletrônica — o que ela é e o que não é

A evidência registrada é um SHA-256 sobre o conteúdo canônico da etapa, somado à identidade
do signatário e ao instante do consentimento. Isso comprova integridade e intenção.

**Não é** assinatura qualificada ICP-Brasil, não carrega carimbo de tempo confiável e não
substitui o programa institucional de certificação. A integração certificada tem um ponto de
entrada explícito em `server/signature/provider.ts`; o provedor atual se declara como não
qualificado.

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm env:setup` | Cria `.env` com código de cadastro e segredo de sessão |
| `pnpm dev` | API + interface em modo desenvolvimento |
| `pnpm start:local` | API + interface já compilada |
| `pnpm build:web` / `pnpm build` | Compila interface / API |
| `pnpm check`, `pnpm lint`, `pnpm test` | TypeScript, lint e testes |
| `pnpm db:push` | Aplica as migrações MySQL (exige `DATABASE_URL`) |
| `pnpm fb:emulators` | Sobe os emuladores de Auth e Firestore |
| `pnpm fb:deploy` | Publica interface, API e regras no Firebase |

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `app/` | Rotas Expo Router (desktop principal, mobile complementar) |
| `lib/workflow-rules.ts` | Definição das etapas e transições |
| `lib/workflow-server-core.ts` | Regras puras: ordem, bloqueio, consentimento, versão, idempotência |
| `server/workflow/` | Porta de armazenamento, adaptadores Firestore/MySQL/arquivo, serviço transacional |
| `server/identity/` | Porta de identidade: Firebase Auth ou contas locais |
| `server/firebase/` | Inicialização do Admin SDK |
| `server/store/` | Armazenamento em arquivo usado quando não há Firebase nem MySQL |
| `server/signature/` | Adaptador da camada de assinatura |
| `firestore.rules` | Regras que negam qualquer escrita vinda do cliente |
| `server/routers.ts` | Endpoints tRPC de identidade e do workflow |
| `drizzle/` | Esquema e migrações |
| `tests/` | Regras do trâmite, integração com dois usuários, cookie, URL da API, auth e PDF |

Documentação complementar: `CLAUDE_CODE_HANDOFF.md` (estado, arquitetura e limitações),
`auth_design.md`, `design.md`, `research_certificacao.md`, `roteiro_implantacao.md` e
`todo.md`.
