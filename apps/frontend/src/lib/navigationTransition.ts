/**
 * Pathname compartido entre remounts de AppLayout
 * (cada grupo de rutas protegidas monta su propio layout).
 */
let lastNavigatedPathname: string | null = null;

export function getLastNavigatedPathname() {
  return lastNavigatedPathname;
}

export function setLastNavigatedPathname(pathname: string) {
  lastNavigatedPathname = pathname;
}
