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

Rodando localmente, o endereço só existe na sua máquina. Para ter um link que a corporação
acesse, é preciso hospedar em um servidor alcançável pela rede, com HTTPS. O app é um
servidor Node (Express + tRPC) mais uma pasta estática:

```bash
pnpm build:web
pnpm build                      # empacota a API em dist/
NODE_ENV=production node dist/index.js
```

Sirva `dist-web` pelo mesmo domínio da API (ou defina `EXPO_PUBLIC_API_BASE_URL` apontando
para ela). Para mais de uma instância, configure `DATABASE_URL` e aplique as migrações com
`pnpm db:push` — o armazenamento em arquivo é de processo único.

Use HTTPS em produção: o cookie de sessão só pode usar `SameSite=None` (necessário quando a
interface e a API ficam em domínios distintos) sobre conexão segura.

## Como o documento é compartilhado

O processo vive no servidor, não no navegador. Todo signatário autenticado lê e escreve o
mesmo documento, e a interface revalida periodicamente para refletir o que os outros fizeram.

Sem sessão válida, o app cai em **modo local**: cada navegador guarda a própria cópia. Esse
modo existe como rede de proteção e fica sinalizado na tela, porque uma planilha assinada em
modo local não chega aos demais participantes.

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
| `pnpm db:push` | Aplica as migrações (exige `DATABASE_URL`) |

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `app/` | Rotas Expo Router (desktop principal, mobile complementar) |
| `lib/workflow-rules.ts` | Definição das etapas e transições |
| `lib/workflow-server-core.ts` | Regras puras: ordem, bloqueio, consentimento, versão, idempotência |
| `server/workflow/` | Porta de armazenamento, adaptadores MySQL/arquivo, serviço transacional |
| `server/store/` | Armazenamento em arquivo usado quando não há `DATABASE_URL` |
| `server/signature/` | Adaptador da camada de assinatura |
| `server/routers.ts` | Endpoints tRPC de identidade e do workflow |
| `drizzle/` | Esquema e migrações |
| `tests/` | Regras do trâmite, integração com dois usuários, cookie, URL da API, auth e PDF |

Documentação complementar: `CLAUDE_CODE_HANDOFF.md` (estado, arquitetura e limitações),
`auth_design.md`, `design.md`, `research_certificacao.md`, `roteiro_implantacao.md` e
`todo.md`.
