import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StoryBoard',
    short_name: 'StoryBoard',
    description: 'Turn client requirements into structured stories and collaborate with your team.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F2F7',
    theme_color: '#B8944E',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      }
    ],
  }
}
