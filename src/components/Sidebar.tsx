"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { destinations } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="w-56 shrink-0 border-r border-black/10 dark:border-white/10"
    >
      {/* The wordmark is the home link, styled like a terminal prompt. The
          blinking caret is pure CSS (see globals.css) so there's no client work
          just to animate a cursor. */}
      <Link
        href="/"
        aria-label="devidence home"
        className="flex items-center gap-1 px-4 py-4 font-mono text-sm font-semibold tracking-tight"
      >
        <span>devidence</span>
        <span aria-hidden className="text-black/40 dark:text-white/40">
          {">"}
        </span>
        <span
          aria-hidden
          className="inline-block h-4 w-2 translate-y-[1px] animate-caret bg-black/40 dark:bg-white/40"
        />
      </Link>

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
