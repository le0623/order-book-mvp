const webpack = require('webpack')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
       
    if (!isServer) {
      // For browser builds, ignore these Node.js-specific modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ws: false,
        'ws/browser': false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
      };
      
    }
    
    return config
  }
}

module.exports = nextConfig

