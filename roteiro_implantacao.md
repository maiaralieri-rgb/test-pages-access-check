# Roteiro de Implantação — AssinaFluxo e Plataforma Própria de Assinaturas

## Delimitação da entrega atual

O aplicativo já demonstra o trâmite da **PM-COM-002** com criação do processo, blocos em ordem, preenchimento da etapa ativa, manifestação explícita de vontade, bloqueio após a confirmação, impressão SHA-256 do conteúdo da etapa e linha do tempo. A versão de demonstração usa dados persistidos no dispositivo para permitir a validação do fluxo móvel sem alegar uma certificação externa inexistente.

> A aplicação registra **evidência eletrônica**; ela não emite certificados ICP-Brasil e não deve ser apresentada como assinatura eletrônica qualificada enquanto a estrutura institucional necessária não estiver credenciada.

## Estratégia recomendada

| Camada | Resultado esperado | Estado na demonstração | Condição para produção |
| --- | --- | --- | --- |
| Tramitação da LMP | Processos, etapas, ordem, campos bloqueados e histórico compartilhado | Fluxo e regras implementados localmente | Migrar o repositório de dados para o backend autenticado e controlar as permissões por participante |
| Evidência de assinatura | Ciência, manifestação de vontade, hash do conteúdo e carimbo de data | Confirmação, hash e auditoria implementados | Executar hash, registro de data e autorização no servidor, com retenção e proteção dos registros |
| Notificação da vez | Aviso ao próximo responsável assim que a etapa for liberada | Central de pendências e reenvio registrados no histórico | Cadastrar dispositivos/canais dos participantes e integrar entrega remota institucional |
| Certificação própria | Assinatura avançada sob controles da instituição | Arquitetura e limites documentados | Aprovar identidade, governança, segurança, retenção e evidências com as áreas responsáveis |
| Assinatura qualificada | Certificado emitido na cadeia ICP-Brasil | Não alegada | Conduzir programa de credenciamento, políticas, práticas, auditorias e operação exigidos pela ICP-Brasil |

## Programa de implantação institucional

### 1. Colaboração e identidade

O primeiro incremento de produção deve substituir a base local por usuários autenticados, participantes convidados, perfis de autoridade e permissão por etapa. O servidor deve verificar, a cada operação, que o usuário é o responsável configurado para a etapa ativa; a interface não deve ser a única barreira de autorização. A planilha PDF original e as versões consolidadas devem ser armazenadas com controle de acesso, enquanto os campos estruturados preservam o bloqueio seletivo de cada bloco.

### 2. Evidência eletrônica e integridade

Cada assinatura precisa preservar a identidade usada, o texto de ciência, o conteúdo exato da etapa, o resultado do hash, data e hora, identificador da transação, encadeamento com o evento anterior e o resultado de validação. A validação e a geração da impressão de integridade devem ocorrer no serviço de backend para impedir que um cliente alterado produza registros fora das regras.

### 3. Notificações e operação

O processo deve gerar uma pendência somente quando a etapa anterior estiver registrada. O serviço de notificações deverá manter o canal de cada signatário, registrar tentativas e status de entrega e oferecer reenvio com auditoria. A central de avisos do aplicativo continuará sendo a fonte de consulta, para que uma falha em canal externo não oculte uma pendência ativa.

### 4. Plataforma própria e nível de assinatura

Uma plataforma da própria instituição pode ser projetada para o nível de assinatura eletrônica avançada, desde que sua política de uso, autenticação, integridade, exclusividade de controle e aceitação estejam alinhadas à finalidade do processo. A Lei nº 14.063/2020 define essas características e distingue esse nível da assinatura qualificada.[1]

Para oferecer assinatura qualificada, o caminho não é apenas implementar uma tela ou um algoritmo: o certificado deve estar no modelo previsto para a ICP-Brasil, cuja estrutura possui cadeia de confiança, credenciamento, supervisão e auditoria.[2] Os documentos oficiais incluem normas próprias para política de segurança, credenciamento, políticas de certificado e práticas de certificação.[3] Essa frente deve ser conduzida como um programa institucional com liderança jurídica, segurança da informação, gestão de riscos e operação de infraestrutura.

## Próximas decisões institucionais

| Decisão | Responsáveis indicados | Efeito no produto |
| --- | --- | --- |
| Definir se a primeira operação será avançada ou qualificada | Área jurídica, comando e segurança da informação | Determina a política de evidências e o programa de certificação |
| Definir o diretório oficial de usuários e papéis | Tecnologia e gestão de pessoas | Permite vincular o signatário à etapa correta |
| Definir guarda, classificação e prazo de retenção | Arquivo, jurídico e proteção de dados | Determina a estrutura de armazenamento e acesso ao histórico |
| Definir o canal institucional de aviso | Tecnologia e comunicação | Viabiliza avisos remotos, com reenvio e rastreabilidade |
| Instituir governança de certificação | Alta administração, segurança e jurídico | Necessária antes de qualquer declaração de assinatura qualificada ou emissão de certificados |

## Referências

[1] [Lei nº 14.063, de 23 de setembro de 2020 — Planalto](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm)

[2] [ICP-Brasil — Instituto Nacional de Tecnologia da Informação](https://www.gov.br/iti/pt-br/assuntos/icp-brasil)

[3] [Documentos Principais da ICP-Brasil — Instituto Nacional de Tecnologia da Informação](https://www.gov.br/iti/pt-br/assuntos/legislacao/documentos-principais)
