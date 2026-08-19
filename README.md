# AssinaFluxo — tramitação digital da PM-COM-002 (LMP)

Aplicação web desktop-prioritária para tramitar a planilha **PM-COM-002 / Láurea do Mérito
Pessoal**. Mantém a ordem das etapas, libera a edição apenas do bloco corrente, registra a
manifestação de vontade e as evidências de integridade, e gera o PDF a partir do formulário
original.

## Como executar

```bash
pnpm install
cp .env.example .env      # preencha os valores no ambiente de destino
pnpm db:push              # aplica as migrações (requer DATABASE_URL)
pnpm dev                  # web + API
```

Comandos auxiliares: `pnpm dev:metro` (somente web), `pnpm dev:server` (somente API),
`pnpm check` (TypeScript), `pnpm lint`, `pnpm test`, `pnpm build`.

As variáveis obrigatórias estão nomeadas em `.env.example`. `ASSINAFLUXO_REGISTRATION_CODE`
existe apenas no ambiente do servidor — nunca no cliente, em commits ou em documentação. Sem
esse segredo, nenhum cadastro é aceito.

## Como o documento é compartilhado

O processo vive no banco, não no navegador. Todo signatário autenticado lê e escreve o mesmo
documento, e a interface revalida periodicamente para refletir o que os outros fizeram.

Sem sessão válida ou sem `DATABASE_URL`, o app cai em **modo local**: cada navegador guarda a
própria cópia. Esse modo existe como rede de proteção para desenvolvimento e fica sinalizado na
tela, porque uma planilha assinada em modo local não chega aos demais participantes.

## Ordem das assinaturas

As dez etapas seguem a sequência do formulário: indicação (Art. 6º), informações pessoais (P/1),
informações disciplinares (PJMD), pareceres de Cmt Cia e Cmt Btl, parecer da autoridade, situação
excepcional, aprovação do Subcomandante, concessão (Art. 8º) e publicação/remessa. Etapas
opcionais podem ser dispensadas; as demais precisam ser assinadas na ordem.

O servidor não confia na interface. Ao assinar, dentro de uma única transação, ele revalida a
sessão, o vínculo da conta com a função daquela etapa, a conclusão das etapas anteriores, a
manifestação de vontade e a versão do documento; só então grava a evidência, congela o bloco e
libera a etapa seguinte. Uma requisição repetida devolve a assinatura original em vez de
registrar uma segunda.

## Cadastro por função

O coordenador abre o processo, seleciona a etapa e usa **Link da etapa**. O servidor devolve um
token de uso único com expiração. O convidado acessa `/cadastro?convite=TOKEN`, informa o código
padrão, nome, matrícula, e-mail e senha particular, e a conta passa a ser vinculada àquele
processo, etapa, função e ordem de assinatura.

## Assinatura eletrônica — o que ela é e o que não é

A evidência registrada é um SHA-256 sobre o conteúdo canônico da etapa, somado à identidade do
signatário e ao instante do consentimento. Isso comprova integridade e intenção.

**Não é** assinatura qualificada ICP-Brasil, não carrega carimbo de tempo confiável e não
substitui o programa institucional de certificação. A integração certificada tem um ponto de
entrada explícito em `server/signature/provider.ts`; o provedor atual se declara como não
qualificado.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `app/` | Rotas Expo Router (desktop principal, mobile complementar) |
| `lib/workflow-rules.ts` | Definição das etapas e transições |
| `lib/workflow-server-core.ts` | Regras puras: ordem, bloqueio, consentimento, versão, idempotência |
| `server/workflow/` | Porta de armazenamento, adaptadores MySQL e memória, serviço transacional |
| `server/signature/` | Adaptador da camada de assinatura |
| `server/routers.ts` | Endpoints tRPC de identidade e do workflow |
| `drizzle/` | Esquema e migrações |
| `tests/` | Regras do trâmite, integração com dois usuários, auth e exportação do PDF |

Documentação complementar: `CLAUDE_CODE_HANDOFF.md` (estado, arquitetura e limitações),
`auth_design.md`, `design.md`, `research_certificacao.md`, `roteiro_implantacao.md` e `todo.md`.
