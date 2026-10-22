import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // La exportación de productos de Pulpos pesa ~1 MB y el límite por
    // defecto de las Server Actions es 1 MB, así que la importación de Excel
    // fallaba antes de empezar.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
