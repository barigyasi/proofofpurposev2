import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

interface Props {
  source: string;
  className?: string;
}

/**
 * Sanitized markdown renderer. Styled via Tailwind Typography (`prose`) so
 * articles stay readable across light/dark + the alt card themes.
 */
export function MarkdownView({ source, className }: Props) {
  return (
    <div
      className={
        "prose prose-neutral dark:prose-invert max-w-none " +
        "prose-headings:font-display prose-headings:tracking-tight " +
        "prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl " +
        "prose-p:leading-relaxed prose-p:text-foreground " +
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline " +
        "prose-strong:text-foreground " +
        "prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:font-display prose-blockquote:not-italic " +
        "prose-code:rounded-none prose-code:border prose-code:border-foreground prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.9em] " +
        "prose-pre:rounded-none prose-pre:border-2 prose-pre:border-foreground prose-pre:bg-secondary " +
        "prose-img:rounded-none prose-img:border-2 prose-img:border-foreground " +
        "prose-hr:border-foreground " +
        (className ?? "")
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ node: _n, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
