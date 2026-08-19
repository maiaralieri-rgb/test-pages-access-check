# Publicar o AssinaFluxo no Firebase

Ao final deste roteiro o sistema terá um endereço público
(`https://SEU-PROJETO.web.app`) que qualquer signatário acessa pelo navegador.

Só você pode executar estes passos: eles exigem entrar na sua conta Google e
criar o projeto. Nada aqui pede que segredos sejam compartilhados.

## 1. Criar o projeto

1. Acesse <https://console.firebase.google.com> e clique em **Adicionar projeto**.
2. Dê um nome (ex.: `assinafluxo-lmp`). Anote o **ID do projeto** que o console gerar.
3. O plano **Blaze** é necessário porque Cloud Functions exige faturamento
   habilitado. O uso previsto para dezenas de processos por mês fica dentro da
   cota gratuita; ainda assim, configure um alerta de orçamento.

## 2. Ativar os serviços

No console do projeto:

- **Authentication → Sign-in method → E-mail/senha**: ativar.
- **Firestore Database → Criar banco**: escolha o modo de produção e a região
  `southamerica-east1` (São Paulo).

## 3. Registrar o aplicativo web

Em **Configurações do projeto → Seus aplicativos → Web**, registre um app. O
console exibirá um bloco `firebaseConfig`. Copie esses valores para o `.env`:

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=SEU-PROJETO.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=SEU-PROJETO
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=SEU-PROJETO.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_PROJECT_ID=SEU-PROJETO
```

Esses valores `EXPO_PUBLIC_*` são públicos por natureza — eles apenas
identificam o projeto. Quem autoriza é o Firebase Auth somado às Security
Rules, que negam toda escrita vinda do cliente.

## 4. Definir o código de cadastro

O código exigido de quem cria conta fica só no servidor:

```bash
pnpm env:setup                      # gera um, se ainda não existir
firebase functions:secrets:set ASSINAFLUXO_REGISTRATION_CODE
```

Guarde o valor: ele é entregue apenas a quem deve poder se cadastrar.

## 5. Publicar

```bash
npx firebase login
npx firebase use --add          # selecione o projeto criado
pnpm fb:deploy                  # build da web + build da função + deploy
```

O comando publica três coisas: a interface no Hosting, a API como a função
`api` e as Security Rules do Firestore.

Ao final o terminal mostra a **Hosting URL** — esse é o link para distribuir.

## 6. Primeiro acesso

1. Abra `https://SEU-PROJETO.web.app/cadastro`.
2. Informe o código de cadastro do passo 4.
3. A **primeira conta criada recebe a função de coordenação**.
4. A coordenação abre o processo, seleciona a etapa e usa **Link da etapa** para
   convidar cada signatário. O convite é de uso único e já vincula a pessoa
   àquele processo, etapa, função e posição na ordem de assinatura.

## Como a segurança fica montada

O cliente nunca escreve no banco. Toda alteração passa pela função `api`, que
dentro de uma transação do Firestore revalida sessão, vínculo de função,
conclusão das etapas anteriores, manifestação de vontade e versão do documento
antes de gravar a evidência e liberar a etapa seguinte.

As regras em `firestore.rules` são a segunda barreira: negam qualquer escrita
vinda do navegador. Sem elas, alguém poderia marcar a própria etapa como
assinada editando o banco direto. Esse comportamento é verificado por teste —
inclusive a tentativa de forjar assinatura e a de se promover a coordenador.

## Rodar contra os emuladores antes de publicar

```bash
pnpm fb:emulators     # Auth + Firestore locais
# em outro terminal:
FIREBASE_PROJECT_ID=demo-assinafluxo \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
pnpm dev
```

Com os emuladores ativos, `pnpm test` também executa os testes do adaptador
Firestore (fora disso eles são pulados):

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-assinafluxo pnpm test
```

## Custo e limites

Firestore e Hosting têm cota gratuita generosa para este volume. Cloud Functions
exige o plano Blaze, mas cobra por invocação — um trâmite de LMP gera poucas
dezenas de chamadas. O ponto de atenção é a região: manter tudo em
`southamerica-east1` reduz latência e evita tráfego entre regiões.

## O que continua fora do escopo

A assinatura registrada é eletrônica simples (hash de integridade + identidade +
consentimento). **Não** é assinatura qualificada ICP-Brasil e não carrega
carimbo de tempo confiável. A integração certificada tem ponto de entrada
explícito em `server/signature/provider.ts` e depende do credenciamento
institucional aplicável.
