/**
 * Conventional Commits.
 *
 * O corpo e o rodapé não têm limite de linha porque as mensagens deste
 * repositório explicam decisões, e quebrar o raciocínio em 100 colunas
 * atrapalha mais do que ajuda.
 */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-max-line-length": [0, "always"],
    "footer-max-line-length": [0, "always"],
    "subject-case": [0, "always"],
  },
};

export default config;
