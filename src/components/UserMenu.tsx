/* eslint-disable @next/next/no-img-element */
// The avatar comes from avatars.githubusercontent.com. Using next/image here
// would mean allow-listing the remote domain in the config just for a 28px icon.

export function UserMenu({
  login,
  avatarUrl,
}: {
  login: string;
  avatarUrl: string;
}) {
  return (
    <div className="flex items-center justify-end gap-3 border-b border-black/10 px-8 py-2.5 dark:border-white/10">
      <img
        src={avatarUrl}
        alt=""
        width={28}
        height={28}
        className="rounded-full"
      />
      <span className="text-sm text-black/70 dark:text-white/70">{login}</span>

      {/* POST, not a link: logout over GET is triggerable by third parties. */}
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="rounded-md px-2.5 py-1 text-sm text-black/60 transition-colors hover:bg-black/[0.05] hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
