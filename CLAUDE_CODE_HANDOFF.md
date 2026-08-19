# AssinaFluxo — pacote de transferência para Claude Code

## Objetivo

O AssinaFluxo é uma aplicação web desktop-prioritária para tramitar a planilha PM-COM-002/LMP. O fluxo mantém a ordem das etapas, permite edição apenas no bloco liberado, registra manifestação de vontade e evidências de integridade, notifica pendências no modelo demonstrável, gera PDF a partir do formulário original e prepara cadastro individual por link, função e senha particular.

> **Estado atual:** este pacote contém um protótipo funcional e uma base de segurança/autorização. Ele ainda não deve ser tratado como uma plataforma de assinatura qualificada nem como fonte compartilhada de produção até que os itens da seção de limitações sejam concluídos.

## Versão entregue

| Item | Valor |
| --- | --- |
| Projeto | `assinatura-fluxo-mobile` |
| Nome exibido | AssinaFluxo |
| Plataforma | Expo web + acesso mobile complementar |
| Stack | Expo SDK 54, React Native 0.81, React 19, TypeScript, Expo Router, NativeWind, tRPC, Express, Drizzle |
| Banco | MySQL via Drizzle; migrações em `drizzle/` |
| Último checkpoint | `2e85c654` |
| Prévia desktop no checkpoint | `https://8081-iwoty5bm8zi8c3pbyp0yc-a3ca7c30.us3.manus.computer` |

## Como executar

No diretório raiz do projeto, instale dependências com `pnpm install`. Valide o código com `pnpm check`, valide o lint com `pnpm lint` e execute os testes com `pnpm test`. Para iniciar a experiência web e o servidor local, use `pnpm dev`; para iniciar somente a web, use `pnpm dev:metro`, e para iniciar somente a API, use `pnpm dev:server`.

O projeto usa configuração de ambiente carregada por `scripts/load-env.js`. O segredo obrigatório para o cadastro inicial é `ASSINAFLUXO_REGISTRATION_CODE`. O valor deve existir apenas no ambiente do servidor; não o coloque no cliente, em commits, em documentação pública ou em arquivos `.env` enviados ao Claude Code. A conta criada sem convite quando ainda não existe conta recebe a função inicial de coordenação; cadastros posteriores devem usar links de etapa.

## Mapa de telas

| Rota | Finalidade |
| --- | --- |
| `/` | Visão geral desktop com indicadores e processos que exigem ação |
| `/processos` | Grade desktop de processos, etapa atual e progresso |
| `/avisos` | Central de pendências e lembretes |
| `/processo/novo` | Criação de uma nova LMP |
| `/processo/[id]` | Detalhe do processo, etapas, edição, assinatura, auditoria, links de cadastro e exportação PDF |
| `/login` | Login por e-mail e senha particular |
| `/cadastro?convite=TOKEN` | Cadastro por código padrão e convite de função |

## Arquitetura implementada

A identidade local está em `server/auth/local-auth.ts`. Senhas são transformadas em hash com salt e não são armazenadas em texto puro. Sessões usam tokens aleatórios armazenados por hash e são entregues por cookie HTTP-only no desktop ou Bearer token no mobile. O roteador `server/routers.ts` expõe registro, login, sessão atual, logout, autorização da etapa e criação de convite.

O esquema de banco está em `drizzle/schema.ts`. As entidades de identidade são `local_accounts`, `local_sessions`, `registration_links` e `process_members`. A migração inicial de autenticação está em `drizzle/0001_equal_skullbuster.sql`; a migração que adiciona a ordem da etapa aos convites está em `drizzle/0002_dry_magik.sql`.

A planilha deixou de viver no navegador. As entidades `processes`, `process_stages`, `process_events` e `process_signatures` (migração `drizzle/0003_small_nuke.sql`) são a fonte compartilhada: dois navegadores autenticados leem e escrevem o mesmo documento. O acesso é feito por uma porta de armazenamento (`server/workflow/repository.ts`) com dois adaptadores — `DrizzleWorkflowRepository` para MySQL e `InMemoryWorkflowRepository` para testes e execução sem banco. As regras puras (ordem, bloqueio, consentimento, versão, idempotência) estão em `lib/workflow-server-core.ts`, e `server/workflow/service.ts` as executa dentro de uma transação. O roteador `workflow` em `server/routers.ts` expõe `list`, `get`, `signatures`, `create`, `saveDraft`, `sign`, `skip` e `reminder`.

O vínculo de função é criado pelo convite de etapa. O coordenador seleciona a etapa no detalhe desktop e usa **Link da etapa**. O servidor devolve um token de uso único com expiração. O convidado acessa `/cadastro?convite=TOKEN`, informa o código padrão, nome, matrícula, e-mail e senha particular. Após o cadastro, a conta fica vinculada ao processo, à etapa, à função e à ordem da assinatura.

No detalhe da LMP, `StagePanel` chama a autorização do servidor antes de permitir edição ou assinatura. A interface desabilita os campos, o rascunho e o botão quando a sessão não é válida ou quando a conta não possui o vínculo daquela etapa. Essa checagem é apenas para a interface: a autorização que vale é refeita dentro da transação de `signStage`, junto com a ordem das etapas, o consentimento e a versão do documento.

`WorkflowProvider` (`lib/workflow-store.tsx`) opera em dois modos. Com sessão válida e API respondendo, ele usa a fonte compartilhada e revalida a cada 15 segundos. Sem isso, cai no modo local original, que segue existindo como rede de proteção. O componente `SourceNotice` mostra ao usuário em qual modo ele está, para que ninguém assine uma cópia que os demais não recebem.

A camada de assinatura fica atrás do adaptador `server/signature/provider.ts`. O único provedor incluído é `local-evidence`, que produz um SHA-256 sobre o payload canônico e se declara explicitamente como **não qualificado** (`qualified: false`). A integração certificada deve entrar por esse mesmo contrato, após o credenciamento institucional aplicável.

## PDF original

A PM-COM-002 original é usada como base imutável pelo módulo de exportação. A geração é feita pelo servidor em `server/pdf-export.ts` e usa o arquivo original, escrevendo somente nos campos e coordenadas mapeados em `lib/pdf-export-core.ts`. O resultado preserva duas páginas A4, bordas, títulos, rótulos e organização do formulário. No detalhe do processo, o botão **Gerar PDF** pode ser usado durante o trâmite e após a conclusão.

O texto de evidência inserido nos campos de assinatura é apenas uma representação do histórico do protótipo. Ele não é uma assinatura criptográfica qualificada incorporada ao PDF e não substitui o programa institucional de certificação.

## Testes existentes

| Arquivo | Cobertura |
| --- | --- |
| `tests/workflow-rules.test.ts` | Ordem, bloqueio e liberação de etapas |
| `tests/workflow-service.test.ts` | Fonte compartilhada: dois usuários, função da etapa, ordem das assinaturas, consentimento, bloqueio, idempotência e conflito de versão |
| `tests/api-base-url.test.ts` | Endereço da API em execução local, sandbox hospedado, override e mesma origem |
| `tests/session-cookie.test.ts` | Cookie de sessão: `SameSite`/`Secure` coerentes, domínio por subdomínio e proxy reverso |
| `tests/pdf-export-core.test.ts` | Preservação do PDF original de duas páginas |
| `tests/registration-code.test.ts` | Validação do segredo de cadastro no servidor, inclusive a recusa quando o segredo não está configurado |
| `tests/local-auth.test.ts` | Hash, salt, força de senha, tokens e verificação |

A última execução validada foi: 7 arquivos de teste, 32 testes aprovados e 1 ignorado, `tsc --noEmit` aprovado, lint aprovado com apenas o aviso padrão de módulo do ESLint, `expo export --platform web` gerando as 14 rotas e `pnpm build` gerando o bundle do servidor.

Além dos testes automatizados do repositório, o fluxo foi exercitado contra o servidor em
execução, partindo de estado vazio: 32 verificações por HTTP (cadastro, código de cadastro
inválido, convite de uso único, documento compartilhado entre duas contas, recusa por função,
recusa por ordem, consentimento, bloqueio após assinatura, idempotência, conflito de versão,
geração do PDF, persistência em disco e logout) e 14 verificações de interface em navegador
real (login, sessão em cookie, lista e detalhe do processo vindos do servidor, ordem das
assinaturas e ausência de erros de JavaScript). Também foi verificado que os dados sobrevivem
ao reinício do servidor.

## Limitações que Claude Code deve resolver antes de produção

| Prioridade | Limitação | Situação |
| --- | --- | --- |
| Alta | O estado principal da planilha usava `WorkflowProvider`/armazenamento local; dois navegadores não compartilhavam edições e assinaturas. | **Resolvido.** Tabelas `processes`, `process_stages`, `process_events` e `process_signatures`, com as mutações passando por endpoints tRPC transacionais. O modo local permanece apenas como fallback sinalizado na interface. |
| Alta | A gravação final da assinatura precisava ser transacional no banco compartilhado. | **Resolvido.** `signStage` valida sessão, vínculo de função, etapa anterior, consentimento, versão do documento e idempotência dentro de uma transação, e só então grava a evidência, congela o bloco e libera a etapa seguinte. |
| Alta | Não há integração com assinatura qualificada/certificada. | **Em aberto por decisão de projeto.** O contrato `SignatureProvider` isola o ponto de integração; o provedor atual declara `qualified: false`. Continua dependendo da definição institucional e do credenciamento aplicável. |
| Alta | O app exigia MySQL provisionado para qualquer execução. | **Resolvido.** Sem `DATABASE_URL` o servidor usa `server/store/local-store.ts`, que grava em `.data/assinafluxo.json`. O documento continua compartilhado entre signatários porque o estado vive no servidor, e não no navegador. É de processo único: para várias instâncias, configure `DATABASE_URL`. |
| Alta | O cliente web não encontrava a própria API fora do sandbox hospedado, e o cookie de sessão era descartado em HTTP. | **Resolvido.** `resolveApiBaseUrl` passou a tratar a execução local por porta, e o cookie usa `SameSite=Lax` quando a conexão não é segura (`SameSite=None` sem `Secure` é descartado pelos navegadores). Ambos têm teste de regressão. |
| Média | Avisos e lembretes precisam de entrega remota por e-mail/push. | **Em aberto.** O lembrete grava evento de auditoria, mas não há outbox, preferências, retry nem registro de entrega. |
| Média | Recuperação de senha e administração de contas não estão concluídas. | **Em aberto.** |
| Média | O código padrão de cadastro é um segredo compartilhado. | **Em aberto.** O convite por etapa já é individual, de uso único e com expiração, mas o código padrão continua sendo um segredo compartilhado sem rotação nem rate limit. |

## Roteiro recomendado para continuação

A persistência server-side do workflow e os testes de integração com dois usuários já foram implementados, sem remover o modo local. O que resta, em ordem de prioridade:

Primeiro, validar a migração `0003` contra um MySQL real. O ambiente onde este trabalho foi feito não tinha banco disponível, então os testes rodam contra o adaptador em memória, que reproduz o contrato da porta de armazenamento mas não substitui uma execução real: aplique `pnpm db:push`, suba dois navegadores com contas diferentes e confirme a tramitação ponta a ponta antes de considerar a migração concluída.

Depois, conectar as notificações reais (outbox, preferências, retry e registro de entrega), a recuperação de senha e a administração de contas.

Por fim, a camada de assinatura certificada, implementando `SignatureProvider` com o provedor credenciado, e a auditoria imutável. Antes de publicar, executar `pnpm check`, `pnpm lint`, `pnpm test`, revisar as migrações e criar uma nova versão recuperável.

## Prompt inicial sugerido para Claude Code

> Leia `CLAUDE_CODE_HANDOFF.md`, `auth_design.md`, `design.md`, `research_certificacao.md`, `roteiro_implantacao.md` e `todo.md`. Não apague o fluxo atual. Transforme o workflow local em uma fonte compartilhada server-side com Drizzle/tRPC, mantendo o formulário PM-COM-002 como base do PDF. Implemente transações de assinatura, autorização por função, idempotência, auditoria, notificações e testes de integração com dois usuários. Preserve a experiência desktop como principal e o mobile como complementar. Não invente certificação jurídica; deixe a integração certificada atrás de um adaptador explícito.

## Segurança

Não copie valores de segredos, cookies, tokens, sessões ou credenciais para o Claude Code. Envie apenas o código-fonte e os nomes das variáveis. Gere novos segredos no ambiente de destino e invalide tokens de desenvolvimento antes de utilizar a aplicação em produção.
