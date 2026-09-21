import path from 'node:path';

const ASAR_ARCHIVE_SEGMENT = /([\\/])app\.asar(?=[\\/])/;

/**
 * The tray and window icons must be read from a real file. Electron loads a `.ico` from inside
 * app.asar by first copying it out to the system temp folder, and on a machine whose temp folder
 * is not writable (one activation cracker rewrites `TEMP`/`TMP` to a folder under Program Files)
 * that copy fails and the image comes back empty — no tray, no error beyond `icon-empty`. The
 * builder config unpacks `assets/icon.ico` beside the archive, and this resolves to that copy on
 * a packaged build; an unpackaged run has no `app.asar` segment and reads the source tree's file.
 */
export function resolveAppIconPath(mainDirname: string): string {
  return path
    .join(mainDirname, '../../assets/icon.ico')
    .replace(ASAR_ARCHIVE_SEGMENT, '$1app.asar.unpacked');
}
