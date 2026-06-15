// Small monochrome icon set for the message meta row + actions. Inherit color
// via `currentColor` and size via the `size` prop (default 14). Stroke-based to
// sit calmly in the Claude-style aesthetic — no emoji.
interface IconProps {
  size?: number
}

function svg(size: number, children: React.ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function ThumbUpIcon({ size = 14 }: IconProps) {
  return svg(size, <><path d="M7 10v11" /><path d="M7 10l4-7a2 2 0 0 1 3 1.8V9h4.5a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17.2 19H7" /></>)
}

export function ThumbDownIcon({ size = 14 }: IconProps) {
  return svg(size, <><path d="M17 14V3" /><path d="M17 14l-4 7a2 2 0 0 1-3-1.8V15H5.5a2 2 0 0 1-2-2.4l1.3-6A2 2 0 0 1 6.8 5H17" /></>)
}

export function ShieldIcon({ size = 14 }: IconProps) {
  return svg(size, <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />)
}

export function EscalateIcon({ size = 14 }: IconProps) {
  return svg(size, <><path d="M4 17l6-6 4 4 6-7" /><path d="M16 8h4v4" /></>)
}

export function RefreshIcon({ size = 14 }: IconProps) {
  return svg(size, <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></>)
}

export function CopyIcon({ size = 14 }: IconProps) {
  return svg(size, <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>)
}

export function CheckIcon({ size = 14 }: IconProps) {
  return svg(size, <path d="M5 13l4 4L19 7" />)
}
