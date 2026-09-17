import type { IconProps } from './icons/props.ts'
import { BrandMark } from './BrandMark.tsx'

/** Product name paired with the brand mark; a proper noun, not translated per locale. */
const BRAND_NAME = 'Agent Hub for OPC'

/** Display options for the brand wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading brand mark; defaults to true. */
  includeMark?: boolean | undefined
}

/**
 * Render the brand wordmark: the mark beside the product name.
 * @param props.size - mark height in px and basis for the name's font size (default 24).
 * @param props.className - extra class for layout placement.
 * @param props.includeMark - whether to include the leading mark.
 * @returns the wordmark element (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className, includeMark = true }: BrandWordmarkProps) {
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.3), color: 'currentcolor' }}
    >
      {includeMark && <BrandMark size={size} />}
      <span style={{ fontSize: Math.round(size * 0.7), fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1 }}>
        {BRAND_NAME}
      </span>
    </span>
  )
}
