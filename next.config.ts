import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    // Turbopack requires serializable plugin references — pass as string
    // tuples ([packageName, options]) so the loader can resolve them itself.
    remarkPlugins: [["remark-gfm", {}]],
    rehypePlugins: [],
  },
});

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx", "md"],
};

export default withMDX(nextConfig);
