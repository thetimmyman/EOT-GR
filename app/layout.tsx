import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Guild Raid Analytics',
  description: 'Performance Dashboard for Tacticus Guild Raids',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}