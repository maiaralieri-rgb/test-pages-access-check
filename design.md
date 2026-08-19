# Plano de Interface — AssinaFluxo

## Objetivo do produto

O **AssinaFluxo** digitaliza o trâmite da planilha **PM-COM-002 — Láurea do Mérito Pessoal**. Cada documento é compartilhado com os envolvidos, preenchido por blocos de responsabilidade e encaminhado automaticamente ao próximo signatário. Uma vez firmado um bloco, seus campos deixam de ser editáveis, enquanto os blocos posteriores permanecem disponíveis para quem tiver permissão.

> O protótipo registra a intenção de assinatura, a sequência, a data e a trilha de auditoria. A emissão de uma assinatura com certificado exigirá a conexão posterior a um provedor institucional de assinatura digital e uma validação jurídica do fluxo.

## Premissas de interação móvel

O aplicativo é planejado para uso **vertical em 9:16**, em tela de celular, com ações principais posicionadas no terço inferior e alvos de toque amplos. A estrutura utiliza títulos claros, navegação por abas, hierarquia visual sóbria e confirmações explícitas antes de ações irreversíveis, seguindo convenções de interface do iOS.

## Prioridade de uso em navegador de PC

Na experiência web em telas a partir de 960 px, o AssinaFluxo passa a utilizar uma **área de trabalho horizontal**. A navegação por abas é substituída por barra lateral fixa com acesso a visão geral, processos e avisos. O conteúdo é exibido em painéis largos, permitindo que o usuário consulte o estado do processo, a etapa em edição, a sequência de participantes e a auditoria sem perder o contexto. Em dispositivos menores, a navegação móvel é preservada como acesso complementar.

| Região desktop | Conteúdo | Finalidade |
| --- | --- | --- |
| Barra lateral | Marca, atalhos de navegação e criação de LMP | Trocar de contexto sem ocultar o trabalho em curso |
| Cabeçalho | Título da área, explicação curta e identificação do usuário | Situar a atividade atual e reduzir ambiguidades de navegação |
| Área principal | Indicadores, processos prioritários e ações da etapa atual | Concentrar a operação diária em uma tela larga |
| Painéis auxiliares | Avisos, progresso, participantes e linha do tempo | Exibir contexto e auditoria simultaneamente ao processo |

## Mapeamento do formulário de origem

| Bloco da planilha | Conteúdo gerenciado | Responsável inicial | Situação após assinatura |
| --- | --- | --- | --- |
| Dados pessoais e síntese histórica | Posto/graduação, RE/DC, nome, OPM, grau, protocolo e narrativa | Responsável pela indicação | Bloqueado para alteração; visível a todos os participantes |
| Informações pessoais | Tempo de serviço, grau anterior, avaliação e requisitos | Oficial P/1 ou secretário | Bloqueado para alteração; habilita a próxima etapa |
| Informações disciplinares | Comportamento, processos, cassação e requisitos | Oficial PJMD ou equivalente | Bloqueado para alteração; habilita os pareceres aplicáveis |
| Pareceres e decisão | Parecer Cmt Cia, Cmt Btl, autoridade, situações excepcionais, subcomandante e concessão | Signatários configurados na ordem do processo | Cada bloco é bloqueado individualmente após assinatura |
| Fechamento | Publicação, lançamento no SGP e remessa à OPM | Setor responsável pelo encerramento | Documento concluído e arquivado com trilha de auditoria |

## Lista de telas

| Tela | Conteúdo principal | Funções essenciais |
| --- | --- | --- |
| **Início** | Saudação, pendências prioritárias, indicadores de documentos em andamento e concluídos | Abrir a pendência atual, iniciar novo processo e pesquisar processos |
| **Novo processo** | Dados pessoais e dados do processo, com importação da planilha de origem como referência | Criar a LMP, selecionar grau, informar protocolo e definir a sequência de participantes |
| **Detalhe do processo** | Cabeçalho com status, progresso, data de atualização e uma linha do tempo da tramitação | Consultar a planilha, abrir um bloco, acompanhar quem assina a seguir e compartilhar acesso |
| **Preencher bloco** | Campos do bloco ativo, opções de seleção e resumo de responsabilidades | Salvar rascunho, validar obrigatórios e encaminhar para assinatura |
| **Assinar etapa** | Resumo imutável dos dados, declaração de ciência, identificação do signatário e método de assinatura | Confirmar a assinatura, registrar data e encaminhar automaticamente à próxima etapa |
| **Linha do tempo** | Eventos de criação, edição, assinatura, encaminhamento e conclusão | Auditar autores, horários e alterações permitidas |
| **Participantes** | Lista ordenada de signatários e respectivos papéis | Reordenar apenas etapas ainda não iniciadas, substituir um responsável pendente e reenviar aviso |
| **Perfil e segurança** | Identidade, preferências de avisos e explicação do estado de certificação | Gerenciar alertas e revisar o método de assinatura habilitado |

## Fluxos principais

### Criação e encaminhamento

O responsável inicia uma nova LMP, preenche os dados pessoais e a síntese histórica, define os participantes e confirma a primeira etapa. O aplicativo cria um registro compartilhado, apresenta a linha do tempo inicial e envia o aviso ao primeiro responsável pendente.

### Preenchimento com bloqueio progressivo

Cada participante acessa exclusivamente o bloco que está sob sua responsabilidade. Após salvar, ele revisa os dados em uma tela de confirmação e solicita a assinatura. A confirmação registra a etapa como concluída, congela os campos correspondentes e libera a próxima etapa; participantes posteriores podem consultar os dados já consolidados, mas não alterá-los.

### Consulta e auditoria compartilhada

Todos os participantes do processo podem abrir o detalhe e acompanhar o progresso. A linha do tempo mostra, de modo legível, o responsável, a ação, a data e a consequência de cada evento, sem expor controles de edição para uma etapa que já tenha sido assinada.

### Notificação da vez

Quando uma etapa é liberada, o signatário correspondente recebe um aviso de pendência. Caso a etapa continue pendente, o responsável pela gestão pode reenviar o aviso manualmente. A implementação de entrega em produção dependerá do vínculo de identidade do signatário e de um canal de notificação institucional.

## Linguagem visual

| Elemento | Cor | Uso |
| --- | --- | --- |
| Azul institucional | `#103A5B` | Cabeçalhos, ações principais e destaque de processo ativo |
| Dourado de mérito | `#B48A2C` | Marcos de progressão, selo de LMP e elementos de reconhecimento |
| Fundo claro | `#F5F7FA` | Fundo de telas e contraste suave |
| Superfície | `#FFFFFF` | Cartões, formulários e painéis de leitura |
| Texto principal | `#17212B` | Títulos e conteúdo de maior importância |
| Sucesso | `#1C7C54` | Etapa assinada, documento concluído e confirmação |
| Atenção | `#B7791F` | Pendência e revisão necessária |
| Bloqueado | `#64748B` | Campos congelados e conteúdo apenas para consulta |

O ícone do **AssinaFluxo** utiliza uma folha branca, um selo dourado e uma marca de confirmação sobre fundo azul-marinho. A composição não contém texto, mantém leitura clara em escala reduzida e foi aplicada ao ícone principal, tela de abertura, favicon e ícone adaptativo do Android.

## Decisão técnica do protótipo

O aplicativo manterá a planilha como um **modelo de dados estruturado por blocos**, preservando a ordem, os campos e as decisões do PDF de origem. Essa abordagem permite bloquear cada bloco após a assinatura e manter uma trilha de auditoria verificável. A exportação para PDF preenchido e a assinatura com certificado serão conectadas por uma camada de integração dedicada, sem simular certificação jurídica no dispositivo.

## Plataforma própria de assinatura

A solução será construída em duas camadas que não devem ser confundidas. A primeira é o **núcleo operacional próprio**, responsável pela identidade institucional do usuário, manifestação explícita de vontade, hash do conteúdo assinado, bloqueio da etapa, registro de data, eventos de auditoria encadeados e verificação do comprovante. Essa camada permitirá a assinatura eletrônica com evidências técnicas e governança configurável.

A segunda é a **camada de certificação qualificada**, cuja operação exige credenciamento e conformidade institucional próprios da ICP-Brasil. Enquanto tal estrutura não estiver aprovada e operante, o aplicativo exibirá a situação de cada assinatura como “evidência eletrônica registrada — certificação qualificada pendente”, sem alegar emissão de certificado ICP-Brasil.

| Componente | Responsabilidade no aplicativo | Situação no protótipo |
| --- | --- | --- |
| Identidade institucional | Vincular o usuário, o papel e a etapa autorizada | Demonstração com participante autenticado no fluxo |
| Manifestação de vontade | Exibir o resumo imutável e exigir confirmação antes da assinatura | Implementado como confirmação explícita |
| Integridade | Calcular e armazenar uma impressão do conteúdo da etapa no momento da assinatura | Preparado no modelo de assinatura e auditoria |
| Evidência e auditoria | Registrar eventos, horário, autor, documento e transição de estado | Implementado na linha do tempo |
| Certificado qualificado | Emitir e validar certificados na cadeia ICP-Brasil | Dependente de credenciamento institucional; fora do escopo alegável do protótipo |

## Roteiro institucional de certificação

Para transformar a plataforma própria em um emissor de certificado qualificado, a organização deverá executar um programa separado de credenciamento, segurança, políticas de certificado, práticas de certificação, auditorias e operação conforme os documentos vigentes da ICP-Brasil. O aplicativo já será organizado para não depender de um fornecedor específico, mas essa etapa precisa ser conduzida com responsáveis jurídicos, de segurança da informação e de governança da instituição.

## Exportação do PDF PM-COM-002

A exportação utiliza o próprio arquivo PDF fornecido como **camada imutável de fundo e estrutura**. O gerador escreve somente nos espaços de preenchimento e seleção correspondentes aos dados disponíveis no processo, mantendo as duas páginas A4, cabeçalhos, divisões, rótulos, campos e organização visual do modelo original. Uma exportação pode ser solicitada durante o trâmite ou depois de concluído; blocos ainda não registrados permanecem vazios no PDF.

Os campos de assinatura do modelo recebem a identificação de quem concluiu a etapa e a data de registro da evidência. Esse texto é uma representação do histórico existente no processo e **não substitui** uma assinatura criptográfica qualificada no próprio arquivo PDF, que continuará dependendo da camada institucional de certificação.

| Verificação da amostra | Resultado |
| --- | --- |
| Número de páginas | Mantidas as 2 páginas do formulário original |
| Papel e dimensões | Mantido A4, 595,304 × 841,89 pontos |
| Estrutura visual | Mantidas bordas, títulos, campos, rótulos e blocos do PDF original |
| Conteúdo preenchido | Dados cadastrais, síntese, escolhas das etapas e evidência das assinaturas já registradas |
