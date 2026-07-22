"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { destinations } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Seções"
      className="w-56 shrink-0 border-r border-black/10 dark:border-white/10"
    >
      <div className="px-4 py-4 text-sm font-semibold tracking-tight">devidence</div>
      <ul className="px-2">
        {destinations.map((destination) => {
          const isActive =
            destination.href === "/"
              ? pathname === "/"
              : pathname.startsWith(destination.href);

          return (
            <li key={destination.href}>
              <Link
                href={destination.href}
                aria-current={isActive ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-black/[0.07] font-medium dark:bg-white/10"
                    : "hover:bg-black/[0.04] dark:hover:bg-white/5"
                }`}
              >
                {destination.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
