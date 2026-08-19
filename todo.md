# Project TODO

- [x] Registrar o modelo visual e funcional da planilha PM-COM-002.
- [x] Criar a navegação móvel para início, processos, documento, etapas e auditoria.
- [x] Implementar o formulário estruturado dos dados pessoais e da síntese histórica.
- [x] Implementar as etapas de informações pessoais e disciplinares com campos de decisão.
- [x] Implementar a sequência ordenada de assinaturas e o bloqueio de cada etapa concluída.
- [x] Registrar eventos de criação, edição, assinatura e encaminhamento na linha do tempo.
- [x] Implementar o painel de pendências e o reenvio de aviso ao próximo signatário.
- [x] Preparar a interface de assinatura com estado explícito de integração certificada pendente.
- [x] Incluir identidade visual, ícone do aplicativo e configuração de marca.
- [x] Criar testes determinísticos para regras de sequência e bloqueio.
- [x] Validar a compilação e os principais fluxos do protótipo.
- [x] Mapear os requisitos regulatórios e de governança para uma plataforma própria de assinatura certificada.
- [x] Definir a arquitetura de identidade, consentimento, integridade documental, carimbo de tempo e verificação.
- [x] Implementar o núcleo demonstrável de consentimento e evidências, sem alegar certificação jurídica antes do credenciamento aplicável.
- [x] Produzir o roteiro institucional de credenciamento e conformidade para a camada de assinatura qualificada.
- [x] Redesenhar a navegação e a área de trabalho para uso prioritário em navegadores de PC.
- [x] Criar visualização desktop do processo com painel de etapas, formulário amplo e auditoria simultânea.
- [x] Validar a experiência web em tela ampla e salvar uma nova versão do projeto.
- [x] Mapear os campos e coordenadas da PM-COM-002 para preencher o PDF sem alterar seu modelo visual.
- [x] Implementar a exportação do PDF preenchido durante qualquer etapa e após o encerramento do processo.
- [x] Validar a fidelidade visual do PDF gerado em relação ao formulário original.

- [x] Definir cadastro por link com código de entrada configurável e senha particular.
- [x] Implementar sessão segura, recuperação de acesso e encerramento de sessão.
- [x] Vincular cada usuário a uma função e aos campos de assinatura correspondentes.
- [x] Impedir edição e assinatura fora da função e da etapa liberada.
- [x] Ajustar a experiência principal para desktop e manter a navegação mobile compatível.
- [x] Criar testes de autenticação, autorização por função e assinatura sequencial.
- [x] Validar o fluxo completo e salvar a atualização do projeto.

## Observação de segurança

O código padrão de cadastro deve ser tratado como segredo de configuração no servidor, nunca como valor exposto no cliente ou gravado no código-fonte.

- [x] Preparar pacote completo do projeto para importação no Claude Code.
- [x] Criar guia de execução, arquitetura, migrações, segredos e limitações conhecidas.
- [x] Gerar arquivo compactado e manifesto dos arquivos entregues.
- [x] Validar que o pacote contém código, testes, ativos e documentação necessários.

## Continuação no Claude Code

- [x] Criar as tabelas de processos, etapas, eventos e assinaturas com migração versionada.
- [x] Isolar as regras do trâmite em um núcleo puro e testável (ordem, bloqueio, consentimento, versão, idempotência).
- [x] Criar a porta de armazenamento com adaptador MySQL e adaptador em memória.
- [x] Gravar a assinatura de forma transacional, validando sessão, função, etapa anterior, versão e idempotência.
- [x] Expor o workflow por endpoints tRPC e ligar a interface à fonte compartilhada.
- [x] Manter o modo local como fallback e sinalizar na interface em qual modo o usuário está.
- [x] Isolar a assinatura certificada atrás de um adaptador explícito, sem alegar credenciamento.
- [x] Criar testes de integração com dois usuários, convite, função da etapa e ordem das assinaturas.
- [x] Tornar o app executável sem MySQL, mantendo o documento compartilhado pelo servidor.
- [x] Corrigir o endereço da API na execução local e o cookie de sessão em HTTP.
- [x] Validar o fluxo completo contra o servidor em execução e em navegador real.
- [ ] Validar a migração `0003` contra um MySQL real, com dois navegadores em contas diferentes.
- [x] Migrar para Firebase: Firestore, Firebase Auth e Hosting, com a API como Cloud Function.
- [x] Impedir que o cliente escreva direto no banco, via Security Rules, com teste de invasão.
- [x] Concluir recuperação de senha (Firebase Auth) na tela de acesso.
- [x] Validar o fluxo completo contra os emuladores de Auth e Firestore.
- [x] Validar o fluxo completo em navegador no modo Firebase: cadastro, login, criação, assinatura e segunda conta.
- [x] Impedir que o app caia em cópia local quando o Firebase está configurado.
- [ ] Publicar no projeto Firebase da instituição e distribuir o link.
- [ ] Conectar notificações reais (outbox, preferências, retry e registro de entrega).
- [ ] Concluir a administração de contas (desativar, trocar função, auditoria de acessos).
- [ ] Integrar o provedor de assinatura qualificada após o credenciamento institucional.
