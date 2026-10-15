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
| Variável | Padrão | Função |
|---|---|---|
| `PORT` | 3000 | Porta do servidor |
| `MAX_MB` | 500 | Tamanho máximo por vídeo |
| `DATA_DIR` | ./data | Onde ficam banco e vídeos |
| `SECRET` | gerado em `data/secret` | Chave das sessões |
| `ADMIN_EMAIL` | vazio | Esta conta pode excluir qualquer vídeo ou comentário |

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
