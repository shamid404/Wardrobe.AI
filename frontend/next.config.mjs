/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig = {
  images: {
    domains: ["images.unsplash.com"],
  },
  async rewrites() {
    return [
      { source: "/remove-background", destination: `${BACKEND_URL}/remove-background` },
      { source: "/generate-tryon", destination: `${BACKEND_URL}/generate-tryon` },
      { source: "/history", destination: `${BACKEND_URL}/history` },
      { source: "/api/wardrobe", destination: `${BACKEND_URL}/wardrobe` },
      { source: "/api/wardrobe/:path*", destination: `${BACKEND_URL}/wardrobe/:path*` },
      { source: "/api/auth/me", destination: `${BACKEND_URL}/auth/me` },
      { source: "/api/auth/:path*", destination: `${BACKEND_URL}/auth/:path*` },
      { source: "/static/:path*", destination: `${BACKEND_URL}/static/:path*` },
      { source: "/proxy-image", destination: `${BACKEND_URL}/proxy-image` },
      { source: "/analyze-clothing", destination: `${BACKEND_URL}/analyze-clothing` },
      { source: "/weather", destination: `${BACKEND_URL}/weather` },
      { source: "/assistant/chat", destination: `${BACKEND_URL}/assistant/chat` },
      { source: "/api/outfits", destination: `${BACKEND_URL}/outfits` },
      { source: "/api/outfits/:path*", destination: `${BACKEND_URL}/outfits/:path*` },
      { source: "/api/chat/:path*", destination: `${BACKEND_URL}/chat/:path*` },
    ];
  },
};

export default nextConfig;
