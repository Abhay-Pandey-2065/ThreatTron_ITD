export type NavIconName =
  | 'overview'
  | 'alerts'
  | 'investigations'
  | 'sandbox'
  | 'files'
  | 'processes'
  | 'system'
  | 'usb'
  | 'network'
  | 'ml'
  | 'admin'
  | 'brand'
  | 'chevron-left'
  | 'chevron-right'

const PATHS: Record<NavIconName, string> = {
  overview:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  alerts:
    '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  investigations: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sandbox: '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/>',
  files:
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  processes:
    '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  usb: '<path d="M12 22v-7"/><path d="M8 8h8l-1 4H9z"/><path d="M10 4v4M14 4v4"/>',
  network:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  ml: '<path d="M3 21h18"/><rect x="5" y="11" width="3" height="8"/><rect x="10.5" y="6" width="3" height="13"/><rect x="16" y="13" width="3" height="6"/>',
  admin: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  brand: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
}

/** Small line icons drawn with currentColor, so they follow the text colour and the active state. */
export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  )
}
