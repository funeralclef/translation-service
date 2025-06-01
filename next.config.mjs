// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   eslint: {
//     ignoreDuringBuilds: true,
//   },
//   typescript: {
//     ignoreBuildErrors: true,
//   },
//   images: {
//     unoptimized: true,
//   },
// }

// export default nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Preserve console logs in production for debugging
  compiler: {
    removeConsole: false, // This keeps console.log statements
  },
  // Enable source maps for better debugging in production
  productionBrowserSourceMaps: true,
  // Ensure server-side rendering works properly
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

export default nextConfig