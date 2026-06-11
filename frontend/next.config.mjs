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
      { source: "/assistant/plan-week", destination: `${BACKEND_URL}/assistant/plan-week` },
      { source: "/assistant/plan-day", destination: `${BACKEND_URL}/assistant/plan-day` },
      { source: "/assistant/feedback", destination: `${BACKEND_URL}/assistant/feedback` },
      { source: "/api/plans", destination: `${BACKEND_URL}/plans` },
      { source: "/api/plans/:path*", destination: `${BACKEND_URL}/plans/:path*` },
      { source: "/api/outfits", destination: `${BACKEND_URL}/outfits` },
      { source: "/api/outfits/:path*", destination: `${BACKEND_URL}/outfits/:path*` },
      { source: "/api/chat/:path*", destination: `${BACKEND_URL}/chat/:path*` },
      { source: "/body-photo", destination: `${BACKEND_URL}/body-photo` },
      { source: "/shopping/wishlist", destination: `${BACKEND_URL}/shopping/wishlist` },
      { source: "/shopping/wishlist/:path*", destination: `${BACKEND_URL}/shopping/wishlist/:path*` },
    ];
  },
};

export default nextConfig;
