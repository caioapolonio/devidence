/**
 * Navigation.
 *
 * The macOS app it descends from had four sections because it explored the
 * activity before generating the report. Here the flow is direct: pick a
 * project and a period, generate. Only three remain.
 */
export type Destination = {
  href: string;
  title: string;
};

export const destinations: Destination[] = [
  { href: "/", title: "New report" },
  { href: "/reports", title: "Reports" },
  { href: "/settings", title: "Settings" },
];
