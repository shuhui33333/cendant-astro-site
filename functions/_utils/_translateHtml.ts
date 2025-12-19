// functions/_utils/translateHtml.ts
type Opts = {
  target: string; // "en"
  apiKey: string;
};

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
]);

function shouldSkipNode(node: Node): boolean {
  const p = node.parentElement;
  if (!p) return false;

  // 跳过这些标签内部的文本
  if (SKIP_TAGS.has(p.tagName)) return true;

  // 手动禁用翻译：data-no-translate 或 class=notranslate
  if (p.closest("[data-no-translate]")) return true;
  if (p.closest(".notranslate")) return true;

  return false;
}

function splitKeepWhitespace(s: string) {
  const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return {
    lead: m?.[1] ?? "",
    core: m?.[2] ?? "",
    tail: m?.[3] ?? "",
  };
}

async function googleTranslateBatch(texts: string[], opts: Opts): Promise<string[]> {
  if (!texts.length) return [];

  // Google Translate v2
  const endpoint = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
    opts.apiKey
  )}`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      q: texts,
      target: opts.target,
      format: "text",
    }),
  });

  const raw = await resp.text();
  if (!resp.ok) {
    throw new Error(`Google Translate error ${resp.status}: ${raw}`);
  }

  const data = JSON.parse(raw);
  const arr: string[] = data?.data?.translations?.map((t: any) => t?.translatedText ?? "") ?? [];
  return arr;
}

/**
 * ✅ 只翻译文本节点：稳定版
 */
export async function translateHtmlDocument(html: string, opts: Opts): Promise<string> {
  // Cloudflare workerd / Pages Functions 通常有 DOMParser
  if (typeof DOMParser === "undefined") {
    // 如果你的运行环境没有 DOMParser，就直接返回原文（不让站挂）
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // 收集所有可翻译 textNode
  const walker = doc.createTreeWalker(doc.body || doc, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];

  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    const val = t.nodeValue ?? "";
    if (!val.trim()) continue; // 空白不翻译
    if (shouldSkipNode(t)) continue;

    // 少翻译一些“纯符号”
    const core = val.trim();
    if (!/[A-Za-z\u4e00-\u9fa5]/.test(core)) continue;

    nodes.push(t);
  }

  if (!nodes.length) return doc.documentElement.outerHTML;

  // 去重（省钱）：相同文本只翻译一次
  const unique: string[] = [];
  const indexMap = new Map<string, number>();

  // 每个节点保留原始空白，翻译 core
  const prepared = nodes.map((t) => {
    const { lead, core, tail } = splitKeepWhitespace(t.nodeValue || "");
    const key = core;

    if (!indexMap.has(key)) {
      indexMap.set(key, unique.length);
      unique.push(key);
    }

    return { node: t, lead, core, tail, idx: indexMap.get(key)! };
  });

  // Google 一次请求别太大：分批（防止超限）
  const BATCH = 80;
  const translatedUnique: string[] = new Array(unique.length);

  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    const out = await googleTranslateBatch(chunk, opts);
    out.forEach((v, j) => {
      translatedUnique[i + j] = v;
    });
  }

  // 回填
  for (const it of prepared) {
    const tr = translatedUnique[it.idx] ?? it.core;
    it.node.nodeValue = `${it.lead}${tr}${it.tail}`;
  }

  // 设置 lang（可选）
  doc.documentElement.setAttribute("lang", "en");

  return doc.documentElement.outerHTML;
}
