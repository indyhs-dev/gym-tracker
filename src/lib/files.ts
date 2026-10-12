/**
 * Saves a text file. On phones this opens the share sheet (→ "Save to Files");
 * elsewhere it downloads. Call it straight from a tap: iOS only allows sharing
 * inside the tap itself, so nothing may be awaited before this.
 * Returns false if the person cancelled the share sheet.
 */
export async function saveFile(name: string, content: string, type: string): Promise<boolean> {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  const phone = window.matchMedia('(pointer: coarse)').matches;
  if (phone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return false;
      // Anything else: fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** Copies text to the clipboard. Call it straight from a tap (iOS requirement). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / plain http: copy via a temporary text area.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}
