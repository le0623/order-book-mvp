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
      
      // Ignore ws module in nested node_modules (WalletConnect uses it)
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^ws$/,
          contextRegExp: /node_modules\/@walletconnect/,
        })
      );
    }
    
    // Ignore optional wagmi connector dependencies that may not be installed
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(porto|porto\/internal|@gemini-wallet\/core|@metamask\/sdk|@walletconnect\/ethereum-provider)$/,
      })
    )
    
    return config
  }
}

module.exports = nextConfig

