import Link from 'next/link';

export function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="logo" aria-label="Anvil home">
          <svg className="logo-mark" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <path d="M7 18.5L2.5 17L7 14.5L9 11C11 8 14 7 17.5 7.5L22 8.5L24 7L23 10L26 11C28.5 12.5 29.5 15 29 18L28 21L25 24L20 26L14 25L10 22L7 18.5Z" fill="currentColor"/>
            <circle cx="13" cy="13.5" r="1.5" fill="var(--bg)"/>
            <rect x="8" y="28" width="20" height="3" rx="1" fill="currentColor" opacity="0.6"/>
            <rect x="12" y="26" width="12" height="3" rx="0.5" fill="currentColor" opacity="0.4"/>
          </svg>
          <span className="logo-text">anvil</span>
        </Link>
        <div className="nav-links">
          <Link href="/docs/">Docs</Link>
          <Link href="/explore/">Explore</Link>
          <Link href="/blog/">Blog</Link>
          <a href="https://github.com/64envy64/anvil" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          </a>
        </div>
      </div>
    </nav>
  );
}
