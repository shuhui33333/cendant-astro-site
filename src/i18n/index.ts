// src/i18n/index.ts
import { zh } from "./zh";
import { en } from "./en";

export type Lang = "zh" | "en";

export function getLang(pathname: string): Lang {
  // 兼容 /en 和 /en/
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "zh";
}

export function t(pathname: string) {
  return getLang(pathname) === "en" ? en : zh;
}

export function withLang(href: string, lang: Lang) {
  if (lang === "en") {
    if (href === "/") return "/en";
    return `/en${href}`;
  }
  return href;
}

export function switchLangPath(pathname: string) {
  // 去掉尾部 /
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  // 英 -> 中：去掉 /en 前缀
  if (p === "/en") return "/";
  if (p.startsWith("/en/")) {
    const back = p.replace(/^\/en/, "");
    return back === "" ? "/" : back;
  }

  // 中 -> 英：加上 /en 前缀
  if (p === "/") return "/en";
  return `/en${p}`;
}