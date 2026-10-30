export function normalize(urlOrPath: string) {
  if (urlOrPath.length > 1 && urlOrPath.endsWith('/')) return urlOrPath.slice(0, -1);
  return urlOrPath;
}

/**
 * @returns if `href` is matching the given pathname
 */
export function isActive(href: string, pathname: string, nested = false): boolean {
  href = normalize(href);
  pathname = normalize(pathname);

  return href === pathname || (nested && pathname.startsWith(`${href}/`));
}

/**
 * Checks if a sidebar node URL is active, taking into account query parameters
 * like `?p=1` for session navigation and defaulting session 1 in student view.
 */
export function isNodeActive(
  nodeUrl: string,
  pathname: string,
  searchParams?: URLSearchParams | null,
  isIndex = false,
): boolean {
  const [nodePath, nodeQuery] = nodeUrl.split('?');
  const normalizedNodePath = normalize(nodePath);
  const normalizedCurrentPath = normalize(pathname);

  // The base path must match exactly
  if (normalizedNodePath !== normalizedCurrentPath) {
    return false;
  }

  const nodeParams = new URLSearchParams(nodeQuery || '');
  const nodeP = nodeParams.get('p');
  const currentP = searchParams?.get('p') || null;

  // Case 1: Node specifies a specific session (?p=X)
  if (nodeP !== null) {
    return currentP !== null && nodeP === currentP;
  }

  // Case 2: Node is a folder index (Semua Pertemuan / Course Overview)
  if (isIndex) {
    // If a session ?p=... is currently selected, the specific session is active, not the folder index
    return currentP === null;
  }

  // Case 3: Regular pages without session parameters (/dashboard/assignments, /dashboard/mentor/presensi, etc.)
  return true;
}
