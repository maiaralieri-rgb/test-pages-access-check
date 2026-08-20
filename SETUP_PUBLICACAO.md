# Configuração única — depois disso você não mexe mais em nada

Ao terminar, o sistema estará num endereço público e **toda alteração que eu
enviar se publica sozinha**. Você não precisará abrir console nenhum de novo.

Tempo estimado: 20 a 30 minutos. Nenhum cartão de crédito é necessário.

## Como fica montado

| Parte | Onde roda | Custo |
| --- | --- | --- |
| Contas e login | Firebase Authentication | grátis (Spark) |
| Banco de dados | Firebase Firestore | grátis (Spark) |
| Interface e API | Vercel | grátis (Hobby) |

Cloud Functions ficou de fora porque exige o plano Blaze, com cartão. A Vercel
roda a mesma API, então **a segurança é idêntica**: a validação de ordem e função
continua no servidor, dentro de uma transação, e o navegador nunca escreve
direto no banco.

---

## Regra de segurança

Em nenhum momento você vai me mandar a chave de acesso pelo chat. Ela vai direto
do Google para o cofre da Vercel. Eu nunca vejo o valor — e mesmo assim tudo
funciona, porque quem usa a chave é o servidor da Vercel, não eu.

Se alguém pedir que você cole uma chave de serviço numa conversa — inclusive eu —
**não faça**. Não é necessário.

---

# PARTE 1 — Firebase (o que talvez você já tenha feito)

No `console.firebase.google.com`, dentro do projeto **assinafluxo-lmp**:

**1.1 — Authentication**
- Lateral → **Segurança** → **Authentication** → **Vamos começar**
- Aba **Sign-in method** → **E-mail/senha** → ative a **primeira** chave → **Salvar**

**1.2 — Firestore** ✅ *(já feito)*

**1.3 — Registrar o app web**
- Botão **+ Adicionar app** na visão geral do projeto → ícone **`</>`**
- Apelido: `AssinaFluxo`
- **Não marque** Firebase Hosting
- **Registrar app** → pode fechar a tela de código que aparecer

> Esse passo é obrigatório. Sem um app Web registrado, a publicação não consegue
> ler a configuração e falha com mensagem explicando isso.

---

# PARTE 2 — Criar a chave de acesso

**2.1** Engrenagem → **Configurações do projeto** → aba **Contas de serviço**

**2.2** **Gerenciar permissões da conta de serviço** (abre o Google Cloud)

**2.3** **+ Criar conta de serviço**
- Nome: `publicador-assinafluxo` → **Criar e continuar**

**2.4** Em **Conceder acesso**, adicione **dois** papéis:

| Papel | Para quê |
| --- | --- |
| Firebase Authentication Admin | Criar contas no cadastro |
| Cloud Datastore User | Ler e gravar no Firestore |

Depois: **Continuar** → **Concluído**.

> São só dois porque a Vercel não precisa publicar nada dentro do Google — ela
> apenas usa Auth e Firestore. É bem menos acesso do que o caminho com Blaze.

**2.5** Clique na conta criada → aba **Chaves** → **Adicionar chave** →
**Criar nova chave** → **JSON** → **Criar**

**2.6** Um arquivo `.json` é baixado. **Não abra em site algum, não mande por
e-mail, não cole em conversa.** Será usado na Parte 4 e depois apagado.

---

# PARTE 3 — Criar a conta na Vercel

**3.1** Acesse `vercel.com` → **Sign Up**

**3.2** Escolha **Continue with GitHub** (usa a conta que você já tem)

**3.3** Escolha o plano **Hobby** — gratuito, sem cartão

**3.4** Autorize a Vercel a acessar seus repositórios do GitHub

---

# PARTE 4 — Publicar

**4.1** No painel da Vercel: **Add New…** → **Project**

**4.2** Encontre `test-pages-access-check` na lista → **Import**

**4.3** Em **Framework Preset**, deixe **Other**. Não altere os campos de build —
o arquivo `vercel.json` do repositório já define tudo.

**4.4** Abra **Environment Variables** e crie **duas**:

**Primeira:**
- Key: `FIREBASE_SERVICE_ACCOUNT`
- Value: abra o `.json` da Parte 2.6 no **Bloco de Notas**, selecione tudo
  (Ctrl+A), copie (Ctrl+C) e cole aqui

**Segunda:**
- Key: `ASSINAFLUXO_REGISTRATION_CODE`
- Value: invente uma senha forte, ex.: `LmpPmesp!2026#Acesso`

> Guarde esse código. **É ele que será exigido de quem for criar conta.** Entregue
> apenas a quem deve ter acesso.

**4.5** **Deploy**. Leva alguns minutos.

**4.6** Ao final, a Vercel mostra o endereço — algo como
`https://test-pages-access-check.vercel.app`. **Esse é o link para distribuir.**

**4.7** Apague o arquivo `.json` do computador, inclusive da lixeira.

---

# PARTE 5 — Autorizar o domínio no Firebase

O Firebase só aceita login vindo de domínios que você autorizar.

**5.1** Console do Firebase → **Authentication** → aba **Settings**
(ou Configurações) → **Domínios autorizados**

**5.2** **Adicionar domínio** → cole o endereço da Parte 4.6, **sem** o `https://`
(exemplo: `test-pages-access-check.vercel.app`)

> Se esquecer este passo, a tela de cadastro abre mas o login falha. É a causa
> mais comum de "não consigo entrar" logo após publicar.

---

# PARTE 6 — Primeiro acesso

**6.1** Abra `https://SEU-ENDERECO.vercel.app/cadastro`

**6.2** Preencha seus dados. No campo **Código padrão de cadastro**, use o valor
da Parte 4.4.

**6.3** **A primeira conta criada vira a coordenação.** Faça a sua primeiro.

**6.4** Para chamar os demais: abra o processo → selecione a etapa → **Link da
etapa**. O link é de uso único e já vincula a pessoa àquela etapa, função e
posição na ordem. Cada convidado também precisa do código de cadastro.

---

## Daqui em diante

1. Eu altero o código e envio para o repositório.
2. A Vercel detecta e publica sozinha.
3. O endereço continua o mesmo.

Você só volta a mexer se quiser trocar o código de cadastro (editar a variável na
Vercel) ou revogar o acesso (apagar a chave na conta de serviço do Google).

---

## Quando o Blaze estiver disponível

Nada precisa mudar — a Vercel continua funcionando. Se ainda assim quiser mover
a API para o Firebase, o repositório já tem tudo pronto (`firebase.json`,
`firestore.rules` e o fluxo do GitHub Actions); basta me avisar.

---

## Se travar

**"Falta a configuração do Firebase"** na publicação → faltou registrar o app Web
(Parte 1.3), ou a variável `FIREBASE_SERVICE_ACCOUNT` não é o JSON completo.

**Cadastro abre mas o login falha** → falta autorizar o domínio (Parte 5).

**"Código de cadastro inválido"** → o valor digitado não confere com a variável
`ASSINAFLUXO_REGISTRATION_CODE`.

**Qualquer outro erro** → na Vercel, abra o deployment → aba **Logs**, e me mande
o trecho da mensagem. Os logs não expõem a chave; pode copiar à vontade.

---

## O que este sistema é, e o que não é

A evidência registrada em cada assinatura é: identidade do signatário,
manifestação de vontade, data/hora e um hash SHA-256 do conteúdo assinado. O
bloco fica congelado depois e a ordem das etapas é validada no servidor.

**Não é** assinatura qualificada ICP-Brasil, não carrega carimbo de tempo
confiável e não substitui o programa institucional de certificação. O ponto de
integração para uma assinatura qualificada já está isolado no código
(`server/signature/provider.ts`), aguardando essa definição.
