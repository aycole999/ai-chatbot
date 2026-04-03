"use client";

import { ChevronDown } from "lucide-react";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Streamdown } from "streamdown";

import { cn } from "@/lib/utils";

type ResponseProps = ComponentProps<typeof Streamdown>;

type MarkdownNode = MarkdownContentNode | MarkdownSectionNode;

interface MarkdownContentNode {
  type: "content";
  content: string;
}

interface MarkdownSectionNode {
  type: "section";
  id: string;
  level: number;
  heading: string;
  children: MarkdownNode[];
}

interface SectionStackEntry {
  level: number;
  path: string;
  children: MarkdownNode[];
  counts: Map<string, number>;
}

const responseContentClass =
  "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto";

const sectionContainerClasses = {
  1: "py-3 first:pt-0 last:pb-0 border-b border-border/40 last:border-b-0",
  2: "mt-3 ml-4 border-l border-border/35 pl-4",
  3: "mt-2 ml-4 border-l border-border/25 pl-4",
  4: "mt-2 ml-3 border-l border-border/20 pl-3",
  5: "mt-2 ml-3 border-l border-border/20 pl-3",
  6: "mt-2 ml-3 border-l border-border/20 pl-3",
} as const;

const sectionTitleClasses = {
  1: "text-lg font-semibold text-foreground",
  2: "text-base font-semibold text-foreground",
  3: "text-[15px] font-semibold text-foreground",
  4: "text-sm font-semibold text-foreground",
  5: "text-sm font-medium text-foreground/90",
  6: "text-xs font-medium uppercase tracking-wide text-foreground/80",
} as const;

function InlineParagraph({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

const inlineHeadingComponents = {
  p: InlineParagraph,
} as NonNullable<ResponseProps["components"]>;

function slugifyHeading(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/\s+#+\s*$/g, "")
    .replace(/[`*_~[\]()]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .slice(0, 48);

  return slug || "section";
}

function normalizeHeadingText(value: string): string {
  return value.replace(/\s+#+\s*$/g, "").trim();
}

function createContentNode(content: string): MarkdownContentNode | null {
  return content.trim().length > 0 ? { type: "content", content } : null;
}

function parseMarkdownSections(markdown: string): MarkdownNode[] {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const rootChildren: MarkdownNode[] = [];
  const stack: SectionStackEntry[] = [
    {
      level: 0,
      path: "root",
      children: rootChildren,
      counts: new Map<string, number>(),
    },
  ];

  let contentBuffer: string[] = [];
  let activeFence:
    | {
        marker: "`" | "~";
        length: number;
      }
    | null = null;

  const flushContentBuffer = () => {
    const content = createContentNode(contentBuffer.join("\n"));
    if (content) {
      stack[stack.length - 1]?.children.push(content);
    }
    contentBuffer = [];
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0] as "`" | "~";
      const length = fenceMatch[1].length;

      if (!activeFence) {
        activeFence = { marker, length };
      } else if (
        activeFence.marker === marker &&
        length >= activeFence.length
      ) {
        activeFence = null;
      }

      contentBuffer.push(line);
      continue;
    }

    if (!activeFence) {
      const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushContentBuffer();

        const level = headingMatch[1].length;
        const heading = normalizeHeadingText(headingMatch[2]);

        while (stack.length > 1 && stack[stack.length - 1]!.level >= level) {
          stack.pop();
        }

        const parent = stack[stack.length - 1]!;
        const slug = slugifyHeading(heading);
        const nextCount = (parent.counts.get(slug) ?? 0) + 1;
        parent.counts.set(slug, nextCount);

        const section: MarkdownSectionNode = {
          type: "section",
          id: `${parent.path}/${slug}-${nextCount}`,
          level,
          heading,
          children: [],
        };

        parent.children.push(section);
        stack.push({
          level,
          path: section.id,
          children: section.children,
          counts: new Map<string, number>(),
        });
        continue;
      }
    }

    contentBuffer.push(line);
  }

  flushContentBuffer();

  return rootChildren;
}

function collectSectionIds(nodes: MarkdownNode[]): string[] {
  const ids: string[] = [];

  const walk = (items: MarkdownNode[]) => {
    for (const item of items) {
      if (item.type !== "section") {
        continue;
      }

      ids.push(item.id);
      walk(item.children);
    }
  };

  walk(nodes);

  return ids;
}

function createHeadingStreamdownProps(
  props: Omit<ResponseProps, "children" | "className">
): Omit<ResponseProps, "children" | "className" | "components" | "mode"> {
  const nextProps = {
    ...props,
  } as Partial<ResponseProps>;

  delete nextProps.components;
  delete nextProps.mode;

  return nextProps as Omit<
    ResponseProps,
    "children" | "className" | "components" | "mode"
  >;
}

function getSectionContainerClass(level: number) {
  return (
    sectionContainerClasses[level as keyof typeof sectionContainerClasses] ||
    sectionContainerClasses[6]
  );
}

function getSectionTitleClass(level: number) {
  return (
    sectionTitleClasses[level as keyof typeof sectionTitleClasses] ||
    sectionTitleClasses[6]
  );
}

function MarkdownChunk({
  content,
  streamdownProps,
}: {
  content: string;
  streamdownProps: Omit<ResponseProps, "children" | "className">;
}) {
  return (
    <Streamdown className={responseContentClass} {...streamdownProps}>
      {content}
    </Streamdown>
  );
}

function SectionHeading({
  heading,
  headingStreamdownProps,
  level,
}: {
  heading: string;
  headingStreamdownProps: Omit<
    ResponseProps,
    "children" | "className" | "components" | "mode"
  >;
  level: number;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div
        aria-level={level}
        className={cn("min-w-0 leading-tight", getSectionTitleClass(level))}
        role="heading"
      >
        <Streamdown
          className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          mode="static"
          components={inlineHeadingComponents}
          {...headingStreamdownProps}
        >
          {heading}
        </Streamdown>
      </div>
    </div>
  );
}

function CollapsibleSection({
  isOpen,
  onToggle,
  renderNodes,
  section,
  headingStreamdownProps,
  streamdownProps,
}: {
  isOpen: boolean;
  onToggle: () => void;
  renderNodes: (nodes: MarkdownNode[]) => ReactNode;
  section: MarkdownSectionNode;
  headingStreamdownProps: Omit<
    ResponseProps,
    "children" | "className" | "components" | "mode"
  >;
  streamdownProps: Omit<ResponseProps, "children" | "className">;
}) {
  const contentId = `${section.id}-content`;

  return (
    <section
      className={cn(
        "transition-colors",
        getSectionContainerClass(section.level)
      )}
      data-heading-level={section.level}
    >
      <button
        aria-controls={contentId}
        aria-expanded={isOpen}
        className="flex w-full items-start gap-3 rounded-lg py-1 text-left transition-colors hover:bg-muted/15"
        onClick={onToggle}
        type="button"
      >
        <span
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground transition-transform",
            isOpen && "text-primary"
          )}
        >
          <ChevronDown
            className={cn("size-4 transition-transform", !isOpen && "-rotate-90")}
          />
        </span>
        <SectionHeading
          heading={section.heading}
          headingStreamdownProps={headingStreamdownProps}
          level={section.level}
        />
      </button>

      {isOpen && (
        <div className="pt-2" id={contentId}>
          <div
            className={cn(
              "space-y-3 border-l border-border/25 pl-5 ml-3",
              section.level >= 2 && "ml-2 pl-4"
            )}
          >
            {renderNodes(section.children)}
          </div>
        </div>
      )}
    </section>
  );
}

export function Response({ className, children, ...props }: ResponseProps) {
  const markdown = typeof children === "string" ? children : "";

  const parsedNodes = useMemo(() => parseMarkdownSections(markdown), [markdown]);
  const sectionIds = useMemo(() => collectSectionIds(parsedNodes), [parsedNodes]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenSections((prev) => {
      const ids = new Set(sectionIds);
      let changed = false;
      const next: Record<string, boolean> = {};

      for (const id of sectionIds) {
        if (id in prev) {
          next[id] = prev[id]!;
          continue;
        }

        next[id] = true;
        changed = true;
      }

      for (const existingId of Object.keys(prev)) {
        if (!ids.has(existingId)) {
          changed = true;
        }
      }

      return changed || Object.keys(prev).length !== Object.keys(next).length
        ? next
        : prev;
    });
  }, [sectionIds]);

  const streamdownProps = props;
  const headingStreamdownProps = useMemo(
    () => createHeadingStreamdownProps(props),
    [props]
  );

  const renderNodes = (nodes: MarkdownNode[]) =>
    nodes.map((node, index) => {
      if (node.type === "content") {
        return (
          <MarkdownChunk
            content={node.content}
            key={`content-${index}`}
            streamdownProps={streamdownProps}
          />
        );
      }

      const isOpen = openSections[node.id] ?? true;

      return (
        <CollapsibleSection
          headingStreamdownProps={headingStreamdownProps}
          isOpen={isOpen}
          key={node.id}
          onToggle={() =>
            setOpenSections((prev) => ({
              ...prev,
              [node.id]: !(prev[node.id] ?? true),
            }))
          }
          renderNodes={renderNodes}
          section={node}
          streamdownProps={streamdownProps}
        />
      );
    });

  if (parsedNodes.every((node) => node.type === "content")) {
    return (
      <Streamdown className={cn(responseContentClass, className)} {...props}>
        {children}
      </Streamdown>
    );
  }

  return (
    <div className={cn("size-full", className)}>
      {renderNodes(parsedNodes)}
    </div>
  );
}
