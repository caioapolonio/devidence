/**
 * Navegação.
 *
 * O app macOS de origem tinha quatro seções porque explorava a atividade antes
 * de gerar o relatório. Aqui o fluxo é direto — escolher projeto e período,
 * gerar — então só sobraram duas.
 */
export type Destination = {
  href: string;
  title: string;
};

export const destinations: Destination[] = [
  { href: "/", title: "Novo relatório" },
  { href: "/relatorios", title: "Relatórios" },
];
