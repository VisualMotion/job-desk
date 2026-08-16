import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Job Desk",
    short_name: "Job Desk",
    description: "Visual Motion's private job handoff portal",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#eef0ee",
    theme_color: "#12161b",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
