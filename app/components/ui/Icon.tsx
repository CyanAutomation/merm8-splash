import type { SVGProps } from 'react'

export type IconName = 'check' | 'error' | 'info' | 'warning'

const iconPaths: Record<IconName, string> = {
  check: 'm5 12 4 4L19 6',
  error: 'M12 8v4m0 4h.01M10.3 3.86 1.82 18.14A2 2 0 0 0 3.54 21h16.92a2 2 0 0 0 1.72-2.86L13.7 3.86a2 2 0 0 0-3.4 0Z',
  info: 'M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  warning: 'M12 9v4m0 4h.01M10.3 3.86 1.82 18.14A2 2 0 0 0 3.54 21h16.92a2 2 0 0 0 1.72-2.86L13.7 3.86a2 2 0 0 0-3.4 0Z',
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'role'> {
  name: IconName
  label?: string
}

export default function Icon({ name, label, className = '', ...props }: IconProps) {
  return (
    <svg
      {...props}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className={['ui-icon', className].filter(Boolean).join(' ')}
      data-name={name}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d={iconPaths[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}
