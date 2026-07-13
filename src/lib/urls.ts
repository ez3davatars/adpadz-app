function hasControlCharacters(value: string): boolean {
  return Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export function safeHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || hasControlCharacters(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function safeActionHref(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || hasControlCharacters(trimmed)) return null;
  if (/^(?:tel|sms|mailto):/i.test(trimmed)) return trimmed;
  return safeHttpUrl(trimmed);
}
