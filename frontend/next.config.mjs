/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Proxy legacy UI calls to FastAPI.
      { source: "/remove-background", destination: "http://127.0.0.1:8000/remove-background" },
      { source: "/generate-tryon", destination: "http://127.0.0.1:8000/generate-tryon" },
    ];
  },
};

export default nextConfig;
