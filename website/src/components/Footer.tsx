import Link from 'next/link';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container-wide">
        <div className="footer-inner">
          <div className="logo">
            <svg className="logo-mark" viewBox="0 0 36 36" fill="none" aria-hidden="true" style={{width:22,height:22,color:'var(--text-3)'}}>
              <path d="M7 18.5L2.5 17L7 14.5L9 11C11 8 14 7 17.5 7.5L22 8.5L24 7L23 10L26 11C28.5 12.5 29.5 15 29 18L28 21L25 24L20 26L14 25L10 22L7 18.5Z" fill="currentColor"/>
              <rect x="8" y="28" width="20" height="3" rx="1" fill="currentColor" opacity="0.6"/>
            </svg>
            <span style={{fontFamily:'var(--font-d)',fontWeight:600,fontSize:'0.95rem'}}>Anvil</span>
          </div>
          <p className="footer-copy">Apache 2.0 &middot; Open Source</p>
          <div className="footer-links">
            <Link href="/docs/">Docs</Link>
            <Link href="/blog/">Blog</Link>
            <a href="https://github.com/64envy64/anvil" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://www.npmjs.com/org/anvil-tools" target="_blank" rel="noopener noreferrer">npm</a>
            <a href="https://discord.gg/anvil-tools" target="_blank" rel="noopener noreferrer">Discord</a>
            <a href="https://x.com/anvil_tools" target="_blank" rel="noopener noreferrer">Twitter</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
