import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import type { BlogPost } from "@/lib/blog";

export function BlogPostHeader({ post }: { post: BlogPost }) {
  const dateLabel = new Date(post.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="max-w-[820px] mx-auto px-6 md:px-8 pt-12 md:pt-16">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-grey-4 tracking-wide">
        <Link href="/" className="hover:text-gold transition-colors">Home</Link>
        <span className="mx-2 opacity-40">/</span>
        <Link href="/blog" className="hover:text-gold transition-colors">Blog</Link>
        <span className="mx-2 opacity-40">/</span>
        <span className="text-navy">{post.category}</span>
      </nav>

      {/* Category eyebrow */}
      <div className="text-gold-warm font-bold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1 inline-block">
        {post.category}
      </div>

      {/* Title */}
      <h1 className="text-navy text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5">
        {post.title}
      </h1>

      {/* Excerpt */}
      <p className="text-grey-3 text-lg md:text-xl leading-relaxed mb-8 font-light">
        {post.excerpt}
      </p>

      {/* Author + meta */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pb-8 mb-2 border-b border-navy/10">
        <Link href="/about" className="flex items-center gap-3 group">
          <div className="relative w-11 h-11 rounded-full overflow-hidden bg-navy">
            <Image
              src="/images/jason.png"
              alt="Jason Stowe — Founder, The Franchisor Blueprint"
              fill
              className="object-cover"
              sizes="44px"
            />
          </div>
          <div>
            <div className="text-navy font-bold text-sm leading-tight group-hover:text-gold transition-colors">
              Jason Stowe
            </div>
            <div className="text-grey-4 text-xs leading-tight mt-0.5">
              Founder, The Franchisor Blueprint
            </div>
          </div>
        </Link>
        <div className="text-grey-4 text-xs flex items-center gap-1.5">
          <span>{dateLabel}</span>
          <span aria-hidden>·</span>
          <Clock size={13} className="text-gold" />
          <span>{post.readingTimeMin} min read</span>
        </div>
      </div>
    </header>
  );
}
