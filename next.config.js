/** @type {import('next').NextConfig} */

// V51 §8 — Les routes mortes repliées en §7 étaient servies par des stubs React
// (`redirect()` côté page) : à l'arrivée, le navigateur chargeait un composant
// qui se redirigeait, générant du bruit console bénin mais « slop »
// (hydratation React #422/#425, « Failed to fetch RSC payload »). On bascule ces
// redirections au niveau edge (307) : aucun composant n'est rendu, la
// redirection est immédiate et silencieuse. Les stubs page.tsx restent en filet
// de sécurité (jamais atteints : redirects() passe avant le routage).
const redirects = async () => ([
  { source: '/',                         destination: '/posts/new',        permanent: false },
  // V52 P0 — La Bibliothèque disparaît : le calendrier est l'unique source de vérité des posts.
  { source: '/posts',                    destination: '/calendar',         permanent: false },
  { source: '/analytics',                destination: '/cerveau',          permanent: false },
  { source: '/brand-dna',                destination: '/cerveau',          permanent: false },
  { source: '/inspirations',             destination: '/cerveau',          permanent: false },
  { source: '/design-visuel',            destination: '/posts/new',        permanent: false },
  { source: '/suggestions',              destination: '/posts/new',        permanent: false },
  { source: '/settings',                 destination: '/sources',          permanent: false },
  { source: '/settings/notion',          destination: '/sources/notion',   permanent: false },
  { source: '/settings/design-system',   destination: '/posts/new',        permanent: false },
  { source: '/settings/import-linkedin', destination: '/sources/linkedin', permanent: false },
  { source: '/sources/github',           destination: '/sources',          permanent: false },
]);

const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins: ['*'] } },
  redirects,
};
module.exports = nextConfig;
