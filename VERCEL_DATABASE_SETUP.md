COMO CONFIGURAR LOGIN GOOGLE + HISTORICO PRIVADO NO V60

Este projeto agora salva o historico em uma planilha privada do Google Sheets dentro do seu Google Drive.
O acesso ao historico fica protegido por login Google, e apenas o e-mail definido por voce nas variaveis da Vercel pode entrar.

==================================================
1. O QUE ESTA SENDO USADO
==================================================

- Frontend React/Vite no Vercel
- Login Google no navegador
- Sessao segura em cookie HttpOnly no backend
- Google Sheets como armazenamento persistente
- GitHub para deploy automatico na Vercel

==================================================
2. CRIAR O CLIENT ID DO GOOGLE LOGIN
==================================================

1. Entre no Google Cloud Console.
2. Crie ou escolha um projeto.
3. Ative a tela de consentimento OAuth.
4. Crie uma credencial do tipo "OAuth Client ID".
5. Tipo da aplicacao: Web application.
6. Adicione os dominios/autorizacoes necessarios:
   - JavaScript origin local: `http://localhost:5173`
   - JavaScript origin producao: `https://SEU-PROJETO.vercel.app`
7. Copie o Client ID gerado.

==================================================
3. CRIAR A CONTA DE SERVICO DO GOOGLE SHEETS
==================================================

1. No mesmo projeto do Google Cloud, abra "Service Accounts".
2. Crie uma service account.
3. Gere uma chave JSON.
4. Guarde estes dados do JSON:
   - `client_email`
   - `private_key`
5. Ative a Google Sheets API no projeto.

==================================================
4. CRIAR A PLANILHA PRIVADA
==================================================

1. Crie uma nova planilha no Google Sheets com a sua conta Google.
2. Copie o ID da planilha pela URL.
3. Compartilhe a planilha apenas com:
   - o seu e-mail Google pessoal
   - o `client_email` da service account
4. Nao compartilhe com mais ninguem.

Observacao:
- O app cria automaticamente a aba `Recipes` se ela ainda nao existir.
- O cabecalho da tabela tambem e criado automaticamente.

==================================================
5. VARIAVEIS DE AMBIENTE NA VERCEL
==================================================

Adicione estas variaveis em Project Settings > Environment Variables:

- `GOOGLE_CLIENT_ID`
  O Client ID do login Google.

- `VITE_GOOGLE_CLIENT_ID`
  O mesmo valor do `GOOGLE_CLIENT_ID`.

- `ALLOWED_GOOGLE_EMAIL`
  O seu e-mail Google exato. Exemplo: `voce@gmail.com`

- `SESSION_SECRET`
  Uma string longa e secreta para assinar a sessao.

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
  O `client_email` do JSON da service account.

- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
  O `private_key` do JSON da service account.
  Importante: cole com `\n` preservado se estiver em uma unica linha na Vercel.

- `GOOGLE_SHEETS_SPREADSHEET_ID`
  O ID da planilha.

- `GOOGLE_SHEETS_SHEET_NAME`
  Opcional. Se nao definir, o app usa `Recipes`.

==================================================
6. GITHUB + VERCEL
==================================================

1. Suba este projeto para um repositorio no GitHub.
2. Conecte o repositorio ao projeto da Vercel.
3. A cada push, a Vercel vai gerar um novo deploy automaticamente.
4. Depois do primeiro deploy, teste:
   - login Google
   - salvar receita
   - abrir historico
   - editar receita salva

==================================================
7. TESTE LOCAL
==================================================

Para frontend puro:

```bash
npm run dev
```

Importante:
- O `npm run dev` continua util para testar a interface.
- Se a API da Vercel nao estiver disponivel localmente, o app entra em modo local e salva no navegador do dispositivo.
- O historico privado real com Google Sheets funciona no deploy da Vercel.

==================================================
8. SEGURANCA
==================================================

- O historico fica na sua planilha privada, nao em `localStorage` no deploy.
- A sessao fica em cookie HttpOnly assinado.
- So o e-mail configurado em `ALLOWED_GOOGLE_EMAIL` consegue entrar.
- Se outro Google tentar login, o backend bloqueia.
