import { Fragment, type ReactNode } from "react";
import type { RichText, TheoryBlock } from "../types/theory";
import { Formula } from "./MathText";
import { headingAnchor } from "./theoryHeadings";

function Text({ value }: { value: RichText[] }) {
  return value.map((r, i) => {
    let node: ReactNode = r.equation ? <Formula expression={r.text} /> : r.text;
    if (r.code) node = <code>{node}</code>;
    if (r.bold) node = <strong>{node}</strong>;
    if (r.italic) node = <em>{node}</em>;
    if (r.strike) node = <s>{node}</s>;
    if (r.underline) node = <u>{node}</u>;
    if (r.href) node = <a href={r.href} target="_blank" rel="noreferrer">{node}</a>;
    return <Fragment key={i}>{node}</Fragment>;
  });
}
export function NotionContent({ blocks }: { blocks: TheoryBlock[] }) {
  const nodes: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const text = <Text value={b.text} />;
    const children = <NotionContent blocks={b.children} />;
    let node: ReactNode;
    if (b.type === "bulleted_list_item" || b.type === "numbered_list_item") {
      const items = [b];
      while (blocks[i + 1]?.type === b.type) items.push(blocks[++i]);
      const Tag = b.type === "bulleted_list_item" ? "ul" : "ol";
      node = <Tag>{items.map(item => <li key={item.id}><Text value={item.text} /><NotionContent blocks={item.children} /></li>)}</Tag>;
    } else switch (b.type) {
      case "heading_1": node = <><h2 id={headingAnchor(b.id)} tabIndex={-1}>{text}</h2>{children}</>; break;
      case "heading_2": node = <><h3 id={headingAnchor(b.id)} tabIndex={-1}>{text}</h3>{children}</>; break;
      case "heading_3": node = <><h4 id={headingAnchor(b.id)} tabIndex={-1}>{text}</h4>{children}</>; break;
      case "image": node = <figure><img src={`${import.meta.env.BASE_URL}${b.src}`} alt={b.text.map(r => r.text).join("")} decoding="async" /><figcaption>{text}</figcaption>{children}</figure>; break;
      case "table": node = <div className="notion-table"><table><tbody>{b.children.map((row, index) => <tr key={row.id}>{row.cells?.map((cell, col) => { const Tag = (b.columnHeader && index === 0) || (b.rowHeader && col === 0) ? "th" : "td"; return <Tag key={col} scope={Tag === "th" ? b.columnHeader && index === 0 ? "col" : "row" : undefined}><Text value={cell} /></Tag>; })}</tr>)}</tbody></table></div>; break;
      case "toggle": node = <details><summary>{text}</summary>{children}</details>; break;
      case "to_do": node = <div><input type="checkbox" checked={!!b.checked} readOnly aria-label={b.text.map(r => r.text).join("") || "Tarea"} /> {text}{children}</div>; break;
      case "quote": node = <blockquote>{text}{children}</blockquote>; break;
      case "callout": node = <div className="example-box">{text}{children}</div>; break;
      case "code": node = <><pre><code>{text}</code></pre>{children}</>; break;
      case "equation": node = <><Formula expression={b.text.map(r => r.text).join("")} display />{children}</>; break;
      case "divider": node = <hr />; break;
      case "column_list": case "column": node = children; break;
      default: node = <><p>{text}</p>{children}</>;
    }
    nodes.push(<Fragment key={b.id}>{node}</Fragment>);
  }
  return <>{nodes}</>;
}
