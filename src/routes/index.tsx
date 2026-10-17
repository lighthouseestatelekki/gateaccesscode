import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "Lighthouse Lekki" },
      { name: "description", content: "Visitor access codes for Lighthouse Estate Lekki." },
      { property: "og:title", content: "Lighthouse Lekki" },
      { property: "og:description", content: "Visitor access codes for Lighthouse Estate Lekki." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
