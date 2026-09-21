import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI News",
    short_name: "AI News",
    description: "Дэлхийн AI-ийн жагсаалт, мэдээ — монголоор.",
    start_url: "/",
    display: "standalone",
    theme_color: "#4f46e5",
    background_color: "#f7f6f2",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
