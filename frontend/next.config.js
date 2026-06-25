/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig
