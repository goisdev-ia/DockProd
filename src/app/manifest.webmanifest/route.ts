import { NextResponse } from 'next/server'

const manifest = {
  name: 'PickProd - Cada pedido conta',
  short_name: 'PickProd',
  description: 'Sistema de gestão de produtividade de separação - grupo Docemel',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  display_override: ['standalone', 'minimal-ui'],
  orientation: 'portrait-primary',
  background_color: '#1a3d1a',
  theme_color: '#1a3d1a',
  categories: ['productivity', 'business'],
  icons: [
    { src: '/AppImages/android/android-launchericon-48-48.png', sizes: '48x48', type: 'image/png', purpose: 'any' },
    { src: '/AppImages/android/android-launchericon-72-72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
    { src: '/AppImages/android/android-launchericon-96-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
    { src: '/AppImages/android/android-launchericon-144-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
    { src: '/AppImages/android/android-launchericon-192-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/AppImages/android/android-launchericon-512-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
  screenshots: [],
  prefer_related_applications: false,
}

export function GET() {
  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
