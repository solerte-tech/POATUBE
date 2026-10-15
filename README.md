# POATUBE

Plataforma de vídeos em que qualquer pessoa cria uma conta e publica os seus próprios vídeos.

## O que já funciona
- Cadastro e login (senha com scrypt, sessão em cookie assinado)
- Upload real de vídeo (MP4, WebM, OGG, MOV) com barra de progresso, miniatura automática ou enviada
- Player com busca de trecho, visualizações, curtidas, comentários, inscrições e páginas de canal
- Botão **Baixar** nos vídeos cujo autor permitiu o download
- Excluir os próprios vídeos e comentários, denunciar vídeos
- Busca, categorias, Em alta, Inscrições, tema claro/escuro, layout para celular

## Rodar no seu computador
Requer Node.js 18 ou superior.

```bash
npm install
npm start
```
Abra http://localhost:3000. Os dados ficam na pasta `data/` (banco `db.json` e vídeos em `uploads/`).

## Variáveis de ambiente

- `PORT` (padrão `3000`): porta do servidor.
- `MAX_MB` (padrão `500`): tamanho máximo de cada vídeo, em MB.
- `DATA_DIR` (padrão `./data`): pasta onde ficam o banco e os vídeos.
- `SECRET` (padrão gerado em `data/secret`): chave usada para assinar as sessões.
- `ADMIN_EMAIL` (padrão vazio): esta conta pode excluir qualquer vídeo ou comentário.

Exemplo:

```bash
PORT=8080 MAX_MB=200 ADMIN_EMAIL=voce@exemplo.com npm start
```

## Publicar no GitHub
```bash
git init && git add . && git commit -m "POATUBE"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/poatube.git
git push -u origin main
```
O GitHub Pages só hospeda páginas estáticas e **não roda o servidor**. Para colocar o POATUBE no ar, use um serviço que execute Node com disco persistente (Render, Railway, Fly.io ou uma VPS). Há um `Dockerfile` pronto; monte um volume em `/data`.

## Antes de abrir ao público
- Use HTTPS (os cookies já são `HttpOnly` e `SameSite=Lax`).
- Defina `ADMIN_EMAIL` e revise as denúncias (ficam em `reports` no `db.json`).
- Publique termos de uso e política de privacidade (LGPD) e tenha um canal para retirada de conteúdo que viole direitos autorais.
- Para muitos usuários, troque o JSON por um banco (SQLite/Postgres) e os vídeos por armazenamento de objetos (S3/R2), e adicione limite de requisições.
