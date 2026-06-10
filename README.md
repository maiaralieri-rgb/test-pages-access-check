# PM-COM-002 — Tramitação Digital da Láurea do Mérito Pessoal (LMP)

Aplicação web que digitaliza o formulário **PM-COM-002 (Láurea do Mérito Pessoal — PMESP)**,
permitindo que o documento tramite e seja assinado digitalmente por todas as autoridades
do fluxo, na ordem correta, com exportação em PDF a qualquer momento.

## Funcionalidades

- **Disponível para todos**: aplicação 100% estática — basta publicar no GitHub Pages e
  compartilhar o link; qualquer pessoa com acesso pode abrir, preencher e assinar.
- **Múltiplas planilhas de láurea**: qualquer usuário pode criar uma nova planilha pelo
  botão **“+ Nova Planilha de Láurea”**. As planilhas ficam listadas na barra lateral.
- **Campos editáveis a qualquer momento**: todos os campos do formulário permanecem
  editáveis durante toda a tramitação, com salvamento automático.
- **Ordem de assinaturas visível e obrigatória**: o painel “Ordem de tramitação e
  assinaturas” mostra as 10 etapas do fluxo (indicação → P/1 → PJMD → pareceres →
  concessão → publicação/visto), indicando o que já foi assinado, quem assinou e qual é
  a **próxima etapa**. O sistema só libera a assinatura da etapa quando todas as
  obrigatórias anteriores estiverem assinadas; etapas opcionais podem ser dispensadas.
- **Assinatura digital** com **nome completo, posto/graduação e CPF** (CPF validado pelo
  algoritmo oficial), data/hora e **código de verificação SHA-256** que vincula o
  signatário ao conteúdo do documento no momento da assinatura. O CPF é exibido
  parcialmente mascarado no documento (LGPD).
- **Exportação em PDF**: botão “Exportar PDF” gera o documento formatado em folhas A4
  via diálogo de impressão do navegador (escolha “Salvar como PDF”).
- **Compartilhamento entre usuários**: exporte a planilha em JSON e envie ao próximo
  signatário, que a importa e continua a tramitação do ponto em que parou.

## Fluxo de tramitação (ordem das assinaturas)

1. Responsável pela Indicação — Autoridade do Art. 6º *(obrigatória)*
2. Informações Pessoais — Oficial P/1 ou Secretário *(obrigatória)*
3. Informações Disciplinares — Oficial PJMD ou equivalente *(obrigatória)*
4. Parecer Cmt Cia / equivalente *(opcional)*
5. Parecer Cmt Btl / equivalente *(opcional)*
6. Parecer *(opcional)*
7. Parecer para Situações Excepcionais — Art. 8º, V *(opcional)*
8. Aprovação do Subcomandante PM — situações excepcionais *(opcional)*
9. Concessão — Autoridades do Art. 8º *(obrigatória)*
10. Publicação e Visto *(obrigatória)*

## Como publicar (GitHub Pages)

1. No repositório, acesse **Settings → Pages**.
2. Em *Source*, escolha **Deploy from a branch** e selecione a branch desejada com a
   pasta `/ (root)`.
3. O sistema ficará disponível em `https://<usuario>.github.io/<repositorio>/`.

## Limitações e observações

- Os dados são gravados no **localStorage do navegador** de cada usuário. Para que o
  documento passe de um signatário a outro, use **Exportar JSON → Importar JSON**
  (por e-mail, SEI, drive etc.). Para sincronização automática em tempo real entre
  usuários seria necessário um backend (ex.: Firebase, Supabase ou API própria).
- A assinatura implementada é uma **assinatura eletrônica simples** (registro de nome,
  graduação, CPF, data/hora e hash de integridade). Ela **não substitui** assinatura
  digital qualificada ICP-Brasil (ex.: gov.br, token A3) quando a norma exigir.
