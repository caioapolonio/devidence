# devidence

Transforma atividade verificável do GitHub em um relatório profissional editável e um PDF 16:9, mantendo separadas a contribuição individual e a evolução do projeto inteiro.

O nome vem de *dev* + *evidence*: a premissa do produto é que nenhuma alegação entra no relatório sem evidência rastreável até um commit, PR, review, issue ou release.

## Estado atual

Este repositório está no começo. O que existe hoje é o front: a navegação e as quatro telas, todas ainda sem dados.

- [x] Shell do front — Next 16, TypeScript, Tailwind 4, App Router.
- [ ] Backend (FastAPI) com autenticação via GitHub App.
- [ ] Sincronização de commits, PRs, reviews, issues e releases.
- [ ] Atribuição pessoal e comparação com o projeto inteiro.
- [ ] Geração assistida do relatório com evidências rastreáveis.
- [ ] Exportação do PDF 16:9.

Enquanto o backend não existir, o app mostra um aviso no topo dizendo que está sem dados. É o comportamento esperado, não um defeito.

## Rodar

```sh
cd apps/web
cp .env.example .env.local
pnpm install
pnpm dev
```

Abra `http://localhost:3000`.

## Estrutura

```
apps/web/     Next.js — interface
services/api/ FastAPI — ainda não migrado para cá
```

## Limites honestos

O app apresenta entregas e evidências. Ele não calcula horas trabalhadas e não usa quantidade de commits como prova de produtividade. A atribuição pessoal depende de login do GitHub, e-mail confirmado, autoria de PR/review ou coautoria identificável — e cobertura parcial permanece visível na interface e no relatório.

## Privacidade

Esta seção será escrita quando o backend existir e o modelo real de credenciais estiver implementado. Até lá, não há promessa a fazer: o front não guarda nem transmite nada.
