# Configuração única — depois disso você não mexe mais em nada

Este guia é feito para ser seguido uma vez só. Ao terminar, o sistema estará no
ar num endereço público e **toda alteração que eu enviar se publica sozinha**.
Você não precisará abrir o console do Firebase de novo.

Tempo estimado: 20 a 30 minutos.

---

## Regra de segurança que vamos seguir

Em nenhum momento você vai me mandar a chave de acesso pelo chat. Ela vai
direto do Google para o cofre de segredos do GitHub. Eu nunca vejo o valor — e
mesmo assim a publicação funciona, porque quem usa a chave é o robô do GitHub,
não eu.

Se algum dia alguém (inclusive eu) pedir que você cole uma chave de serviço em
uma conversa, **não faça**. Não é necessário.

---

## Parte 1 — Criar o projeto (console do Firebase)

1. Acesse <https://console.firebase.google.com> com sua conta Google.
2. Clique em **Criar um projeto**.
3. Nome sugerido: `assinafluxo-lmp`. Anote o **ID do projeto** que aparecer
   embaixo do nome (pode ser diferente, tipo `assinafluxo-lmp-4f2a`).
4. O Google Analytics pode ser desativado — não é usado aqui.

### Habilitar o faturamento

Cloud Functions exige o plano **Blaze**. No menu inferior esquerdo, clique em
**Atualizar** e escolha Blaze, associando uma forma de pagamento.

> O uso previsto — dezenas de processos por mês — fica dentro da cota gratuita.
> Ainda assim, na mesma tela defina um **orçamento com alerta** (ex.: R$ 20/mês)
> para não haver surpresa.

### Ligar os dois serviços

- **Build → Authentication → Vamos começar → E-mail/senha → Ativar → Salvar**
- **Build → Firestore Database → Criar banco de dados**
  - Modo: **produção**
  - Local: **southamerica-east1 (São Paulo)**

### Registrar o aplicativo web

1. Ícone de engrenagem → **Configurações do projeto**.
2. Role até **Seus aplicativos** e clique no ícone **`</>`** (Web).
3. Apelido: `AssinaFluxo`. **Não** marque Firebase Hosting nesta tela.
4. Clique em registrar. Pode fechar a tela de código que aparecer — o sistema lê
   essa configuração sozinho na hora de publicar.

---

## Parte 2 — Criar a chave que o robô vai usar

1. Ainda em **Configurações do projeto**, abra a aba **Contas de serviço**.
2. Clique em **Gerenciar permissões da conta de serviço** (abre o Google Cloud).
3. No topo, **Criar conta de serviço**:
   - Nome: `publicador-assinafluxo`
   - Clique em **Criar e continuar**.
4. Em **Conceder acesso**, adicione estes papéis, um a um:

   | Papel | Para quê |
   | --- | --- |
   | Firebase Admin | Hosting, Firestore e regras |
   | Cloud Functions Admin | Publicar a API |
   | Cloud Run Admin | As funções rodam sobre Cloud Run |
   | Service Account User | Executar a função com identidade própria |
   | Artifact Registry Administrator | Guardar a imagem da função |
   | Cloud Build Editor | Compilar a função |
   | Secret Manager Admin | Guardar o código de cadastro |
   | Service Usage Admin | Ligar as APIs necessárias |

   Clique em **Concluído**.

5. Na lista, clique na conta `publicador-assinafluxo` → aba **Chaves** →
   **Adicionar chave → Criar nova chave → JSON → Criar**.
6. Um arquivo `.json` será baixado. **Não abra em editor online, não envie por
   e-mail e não cole em conversa.** Ele será usado no próximo passo e depois
   pode ser apagado do computador.

---

## Parte 3 — Guardar os segredos no GitHub

1. Abra o repositório no GitHub → **Settings** → **Secrets and variables** →
   **Actions**.
2. Clique em **New repository secret** e crie **dois** segredos:

   **Primeiro:**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: abra o arquivo `.json` baixado num editor de texto simples
     (Bloco de Notas), selecione **todo** o conteúdo, copie e cole aqui.

   **Segundo:**
   - Name: `ASSINAFLUXO_REGISTRATION_CODE`
   - Secret: invente uma senha forte (ex.: `LmpPmesp!2026#Acesso`). **É o código
     que será exigido de quem for criar conta no sistema.** Guarde-o — você vai
     entregá-lo apenas a quem deve ter acesso.

3. Depois de colar, apague o arquivo `.json` do computador (e da lixeira).

---

## Parte 4 — Publicar

Não é preciso rodar comando nenhum. Vá em **Actions** no GitHub → workflow
**Publicar no Firebase** → **Run workflow**.

A execução leva alguns minutos. Ao final, o resumo mostra o endereço:

```
https://SEU-PROJETO.web.app
```

**Esse é o link para distribuir.**

Se algo falhar, o próprio log diz o que faltou. Me mande o trecho do erro que eu
corrijo — sem precisar da sua chave.

---

## Parte 5 — Primeiro acesso

1. Abra `https://SEU-PROJETO.web.app/cadastro`.
2. Preencha seus dados e, no campo **Código padrão de cadastro**, use o valor
   que você criou na Parte 3.
3. **A primeira conta criada vira a coordenação.** Faça a sua primeira.
4. Para chamar os demais: abra o processo, selecione a etapa e clique em
   **Link da etapa**. O link é de uso único e já vincula a pessoa àquela etapa,
   função e posição na ordem de assinatura. Cada convidado também precisará do
   código de cadastro.

---

## Daqui em diante

A partir de agora o ciclo é este, e ele não passa por você:

1. Eu altero o código e envio para o repositório.
2. O robô do GitHub roda tipos, lint e testes.
3. Se tudo passar, ele publica sozinho.
4. Se algum teste falhar, **ele não publica** — o que está no ar continua
   funcionando.

Você só volta aqui se quiser trocar o código de cadastro (basta editar o
segredo no GitHub) ou revogar o acesso do robô (apagar a chave na conta de
serviço).

---

## Se preferir que eu publique direto da conversa

Existe um caminho alternativo: o ambiente do Claude Code aceita variáveis de
ambiente configuradas por você. Colocando `FIREBASE_SERVICE_ACCOUNT` lá, eu
consigo publicar durante a sessão, sem depender do GitHub Actions.

Vale saber a diferença antes de escolher:

- **GitHub Actions** (o que este guia monta): a chave fica só no cofre do
  GitHub, roda sempre igual, e cada publicação fica registrada no histórico.
  Recomendado.
- **Variável no ambiente do Claude Code**: mais direto, porém a chave fica
  disponível para qualquer sessão minha, sem o registro que o Actions dá.

Dá para ter os dois. Mas se for escolher um só, fique com o Actions.

---

## Perguntas que costumam aparecer

**Preciso saber programar para manter isso?**
Não. Depois desta configuração, alterações passam por mim e se publicam
sozinhas.

**E se eu quiser parar tudo?**
No Google Cloud, apague a chave da conta `publicador-assinafluxo`. A partir daí
nenhuma publicação nova acontece — o que está no ar continua no ar.

**Quem consegue ver os documentos?**
Somente contas criadas com o código de cadastro. O navegador nunca escreve
direto no banco: as regras negam qualquer escrita vinda do cliente, e toda
alteração passa pela validação de ordem e função no servidor.

**Isso vale como assinatura digital oficial?**
Não. O que fica registrado é assinatura eletrônica simples — identidade,
consentimento, data/hora e hash de integridade. **Não** é ICP-Brasil e não
substitui o credenciamento institucional. O ponto de integração para uma
assinatura qualificada já está isolado no código, aguardando essa definição.
