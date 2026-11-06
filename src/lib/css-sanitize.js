const BANNED = /@import|@font-face|@namespace|expression\s*\(|javascript\s*:|-moz-binding|url\s*\(/i;

export function sanitizeCss(css) {
  const source = String(css || "");
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "");
  if (BANNED.test(stripped)) {
    return {
      ok: false,
      css: "",
      error: "Custom CSS cannot use @import, @font-face, or url().",
    };
  }
  return { ok: true, css: source, error: "" };
}
