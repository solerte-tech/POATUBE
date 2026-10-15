# POATUBE (GitHub Pages + Supabase)

Site de vídeos em que qualquer pessoa cria uma conta e publica os próprios vídeos.
O site é estático e fica no **GitHub Pages**; login, banco de dados e vídeos ficam no **Supabase**. Não precisa de servidor.

## Passo a passo

### 1. Criar o projeto no Supabase
1. Crie uma conta gratuita em https://supabase.com e clique em **New project**.
2. Abra **SQL Editor**, clique em **New query**, cole todo o conteúdo de `supabase.sql` e clique em **Run**.
3. Em **Project Settings > API**, copie a **Project URL** e a chave **anon public**.

### 2. Configurar o site
Abra `config.js` e troque os dois valores:

```js
window.POATUBE_CONFIG = {
  url: "https://abcdefgh.supabase.co",
  key: "sua-chave-anon-publica",
  maxMB: 50
};
```

A chave `anon` é pública por design. A segurança vem das regras (RLS) criadas pelo `supabase.sql`.

### 3. Publicar no GitHub Pages
```bash
git init && git add . && git commit -m "POATUBE"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/poatube.git
git push -u origin main
```
No GitHub, abra **Settings > Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)` e salve. Em alguns minutos o site abre em `https://SEU-USUARIO.github.io/poatube/`.

### 4. Ajustar o login
No Supabase, em **Authentication > URL Configuration**, coloque o endereço do seu site em **Site URL**.
Em **Authentication > Providers > Email**, você pode desativar **Confirm email** para que novas contas entrem sem confirmar o e-mail (útil para testes).

## Moderação
Para tornar uma conta administradora (pode excluir qualquer vídeo ou comentário e ler as denúncias), rode no SQL Editor:

```sql
update public.profiles set is_admin = true where id = (select id from auth.users where email = 'voce@exemplo.com');
```
As denúncias ficam na tabela `reports` (Table Editor).

## Limites a conhecer
- O arquivo do vídeo é limitado a 50 MB (valor definido em `supabase.sql` e em `config.js`). O plano gratuito do Supabase tem limites de armazenamento e de tráfego; confira os valores atuais no painel deles.
- O envio não mostra barra de progresso; a página avisa "Enviando…" até terminar.
- O contador de visualizações conta cada abertura da página do vídeo.
- Antes de abrir ao público, publique termos de uso e política de privacidade (LGPD) e tenha um canal para retirada de conteúdo que viole direitos autorais.
