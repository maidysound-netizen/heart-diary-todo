import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite는 로컬 개발용 대체 DB라 번들에 넣지 않는다.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
