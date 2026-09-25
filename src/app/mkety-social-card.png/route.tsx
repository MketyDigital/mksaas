import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#07070b',
          color: '#ffffff',
          padding: '72px 82px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 560,
            height: 560,
            borderRadius: 560,
            right: -180,
            top: -220,
            background: 'radial-gradient(circle, rgba(109,93,246,0.42) 0%, rgba(109,93,246,0) 70%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 48,
            fontWeight: 800,
            letterSpacing: '-2px',
          }}
        >
          Mkety
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 930 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '4px',
              textTransform: 'uppercase',
              color: '#a99fff',
              marginBottom: 22,
            }}
          >
            Mkety technology platform
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 66,
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: '-3px',
            }}
          >
            Build. Automate. Deploy. Operate.
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              fontSize: 27,
              lineHeight: 1.4,
              color: '#c9c9d2',
            }}
          >
            AI, automation, deployment, media delivery, business systems, and Enterprise delivery — with clear controls and trusted infrastructure.
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 20, color: '#9696a3' }}>mkety.com</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    },
  );
}
