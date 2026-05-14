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
    ];
  },
};

export default nextConfig;
