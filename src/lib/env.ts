/**
 * Variáveis de ambiente do servidor.
 *
 * Ler por aqui em vez de espalhar `process.env` pelo código dá uma falha clara
 * na primeira chamada quando falta configuração, em vez de um `undefined` que
 * só vira erro estranho três camadas adiante.
 *
 * Nada deste módulo pode ser importado por componente de cliente.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `A variável de ambiente ${name} não está configurada. Veja o .env.example.`,
    );
  }
  return value;
}

export const serverEnv = {
  get githubClientId() {
    return required("GITHUB_CLIENT_ID");
  },
  get githubClientSecret() {
    return required("GITHUB_CLIENT_SECRET");
  },
  /** Mínimo de 32 caracteres — exigência do iron-session. */
  get sessionSecret() {
    const secret = required("SESSION_SECRET");
    if (secret.length < 32) {
      throw new Error(
        "SESSION_SECRET precisa de pelo menos 32 caracteres. Gere um com: openssl rand -base64 32",
      );
    }
    return secret;
  },
  /** Origem pública da aplicação, usada para montar o redirect do OAuth. */
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
};

export const isProduction = process.env.NODE_ENV === "production";
