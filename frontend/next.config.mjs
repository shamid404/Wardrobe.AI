/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Proxy legacy UI calls to FastAPI.
      { source: "/remove-background", destination: "http://127.0.0.1:8000/remove-background" },
      { source: "/generate-tryon", destination: "http://127.0.0.1:8000/generate-tryon" },
      { source: "/api/wardrobe", destination: "http://127.0.0.1:8000/wardrobe" },
      { source: "/api/wardrobe/:path*", destination: "http://127.0.0.1:8000/wardrobe/:path*" },
      { source: "/api/auth/:path*", destination: "http://127.0.0.1:8000/auth/:path*" },
      { source: "/static/:path*", destination: "http://127.0.0.1:8000/static/:path*" },
      { source: "/proxy-image", destination: "http://127.0.0.1:8000/proxy-image" },
      { source: "/analyze-clothing", destination: "http://127.0.0.1:8000/analyze-clothing" },
      { source: "/weather", destination: "http://127.0.0.1:8000/weather" },
      { source: "/assistant/chat", destination: "http://127.0.0.1:8000/assistant/chat" },
      { source: "/api/outfits", destination: "http://127.0.0.1:8000/outfits" },
      { source: "/api/outfits/:path*", destination: "http://127.0.0.1:8000/outfits/:path*" },
      { source: "/api/chat/:path*", destination: "http://127.0.0.1:8000/chat/:path*" },
    ];
  },
};

export default nextConfig;
