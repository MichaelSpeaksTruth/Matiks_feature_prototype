/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from any HTTPS source (for drag-drop previews sourced externally)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

module.exports = nextConfig;
