# devidence

Transforma atividade verificável do GitHub em um relatório profissional e um PDF 16:9 explicando a contribuição de uma pessoa em um projeto, dentro de um período escolhido.

O nome vem de *dev* + *evidence*: a premissa do produto é que nenhuma alegação entra no relatório sem evidência rastreável até um commit, PR, review, issue ou release.

## Estado atual

Este repositório está no começo. O que existe hoje é o esqueleto do front: a navegação e as quatro telas, todas ainda sem dados.

- [x] Shell do front — Next 16, TypeScript, Tailwind 4, App Router.
- [x] Login com OAuth do GitHub.
- [ ] Seleção de repositório e período.
- [ ] Busca de commits, PRs, reviews, issues e releases, com atribuição pessoal.
- [ ] Geração do relatório com evidências rastreáveis.
- [ ] Exportação do PDF 16:9.

## Rodar

Crie um OAuth App em [Developer settings](https://github.com/settings/developers) → **New OAuth App**:

| Campo | Valor |
|---|---|
| Homepage URL | `http://localhost:3000` |
| Authorization callback URL | `http://localhost:3000/api/auth/callback` |

Depois:

```sh
cp .env.example .env.local   # preencha o client id, o secret e o SESSION_SECRET
pnpm install
pnpm dev
```

Abra `http://localhost:3000`.

## Limites honestos

O app apresenta entregas e evidências. Ele não calcula horas trabalhadas e não usa quantidade de commits como prova de produtividade. A atribuição pessoal depende de login do GitHub, e-mail confirmado, autoria de PR/review ou coautoria identificável — e cobertura parcial permanece visível na interface e no relatório.

## Privacidade

Esta seção será escrita quando a autenticação existir. Até lá não há promessa a fazer: o app ainda não lê nem transmite dado nenhum.
