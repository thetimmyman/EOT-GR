/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://ctzowkkbsnztaojllwta.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0em93a2tic256dGFvamxsd3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1MjI2MTIsImV4cCI6MjA1OTA5ODYxMn0.Trla4YlafiLDNZcl1iJGasHnVoW6zU6A8KaFfg3Jz3Y'
  },
  // GitHub Codespaces specific configuration
  async headers() {
    return [
      {
        source: '/:path*.css',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/css',
          },
        ],
      },
    ]
  },
  // Ensure proper asset prefix in GitHub Codespaces
  assetPrefix: process.env.CODESPACES ? `https://${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}` : '',
}

module.exports = nextConfig