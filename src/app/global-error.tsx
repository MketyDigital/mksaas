'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Mkety global render error', {
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#09090b',
            color: '#fafafa',
            padding: '1.5rem',
            textAlign: 'center',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ maxWidth: '32rem' }}>
            <div
              aria-hidden="true"
              style={{
                width: '2.75rem',
                height: '2.75rem',
                borderRadius: '0.8rem',
                display: 'grid',
                placeItems: 'center',
                background: '#6d5df6',
                color: '#fff',
                fontWeight: 700,
                margin: '0 auto 1.25rem',
              }}
            >
              M
            </div>
            <p style={{ margin: 0, opacity: 0.7 }}>Mkety</p>
            <h1 style={{ margin: '0.6rem 0 0', fontSize: '1.8rem' }}>Something went wrong.</h1>
            <p style={{ margin: '0.9rem 0 1.5rem', lineHeight: 1.65, opacity: 0.72 }}>
              We could not finish loading this page. You can retry without exposing internal error details.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: 0,
                borderRadius: '0.7rem',
                background: '#6d5df6',
                color: '#fff',
                fontWeight: 600,
                padding: '0.75rem 1.1rem',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
