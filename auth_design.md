# Modelo de identidade, convite e funções

## Objetivo

Cada signatário deverá acessar o AssinaFluxo por um link de cadastro distribuído pela instituição. O link identifica o processo e pode ser limitado a uma função específica. Antes de criar a conta, o usuário informa o código padrão de entrada, que será validado exclusivamente no servidor. Em seguida, informa seus dados institucionais e define uma senha particular, que será usada nos acessos seguintes.

O código padrão não será armazenado no aplicativo, no PDF, em logs ou no banco de dados. Ele será fornecido como segredo de configuração do servidor, comparado em tempo constante e rotacionável pela administração. O sistema nunca armazenará a senha particular em texto puro; armazenará somente um hash de senha com salt e parâmetros de custo adequados.

## Entidades

| Entidade | Dados principais | Finalidade |
| --- | --- | --- |
| Conta institucional local | nome, e-mail, matrícula, função, hash da senha, estado | Identifica a pessoa que acessa e assina |
| Link de cadastro | token aleatório, processo, função permitida, expiração, uso | Convida uma pessoa para uma etapa específica |
| Sessão local | hash do token, conta, expiração, revogação | Mantém o acesso autenticado sem expor a senha |
| Participação no processo | processo, conta, função, ordem, etapa | Vincula uma conta ao seu campo de assinatura |
| Evento de autorização | conta, ação, processo, etapa, horário, origem | Permite auditar cadastro, login, edição e assinatura |

## Fluxo de cadastro e acesso

1. A instituição cria ou compartilha um link com o signatário.
2. O signatário abre o link no navegador, informa o código padrão e confirma o vínculo com a função indicada.
3. O signatário cadastra nome, e-mail ou matrícula e define uma senha particular.
4. O servidor cria a conta, consome o convite e inicia uma sessão em cookie HTTP-only no desktop ou token seguro no mobile.
5. Nos próximos acessos, o usuário informa sua identificação e senha particular.
6. O processo mostra somente as etapas e campos compatíveis com a função da pessoa; a assinatura só é liberada quando a etapa estiver ativa e a conta for o participante correto.

## Regras de autorização

Uma pessoa pode consultar um processo compartilhado quando tiver participação nele. A edição fica limitada aos campos da etapa ativa e à função autorizada. Uma assinatura só pode ser registrada se a etapa estiver ativa, todos os campos obrigatórios estiverem preenchidos, houver consentimento explícito e o usuário autenticado corresponder ao participante daquela etapa. Depois da assinatura, os campos da etapa tornam-se imutáveis para todos os usuários.

A autenticação por código padrão é apenas uma porta de cadastro inicial. Ela não substitui a senha particular, não autoriza assinatura por si só e não deve aparecer em links, PDFs ou mensagens de notificação.

## Desktop primeiro, mobile complementar

A versão desktop terá a área principal de processos, usuários e pendências. O mobile reutilizará as mesmas regras de servidor e oferecerá consulta, aviso de pendência e assinatura do campo autorizado. Nenhuma autorização será decidida apenas pela interface; a API deverá repetir todas as verificações no servidor.

## Limites da versão

Esse fluxo cria identidade e evidência de acesso, mas não transforma automaticamente a senha local em certificado digital qualificado. A camada de certificação institucional continuará sendo necessária para produzir assinatura qualificada com o efeito jurídico pretendido.
