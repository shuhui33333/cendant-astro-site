import { zh } from "./zh";
import { en } from "./en";

export type Lang = "zh" | "en";

export function getLang(pathname: string): Lang {
  return pathname.startsWith("/en") ? "en" : "zh";
}

export function t(pathname: string) {
  return getLang(pathname) === "en" ? en : zh;
}

/** 把当前路径在中/英之间切换 */
export function switchLangPath(pathname: string) {
  if (pathname.startsWith("/en")) {
    const p = pathname.replace(/^\/en/, "");
    return p === "" ? "/" : p;
  }
  return pathname === "/" ? "/en" : `/en${pathname}`;
}

/** 生成 nav 链接：英文加 /en 前缀 */
export function withLang(href: string, lang: Lang) {
  if (lang === "en") return href === "/" ? "/en" : `/en${href}`;
  return href;
}