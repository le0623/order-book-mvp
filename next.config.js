const webpack = require('webpack')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    
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

