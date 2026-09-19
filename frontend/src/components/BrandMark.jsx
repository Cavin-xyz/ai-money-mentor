/** FinMind monogram. */
export default function BrandMark({ size = 'md' }) {
  const box = size === 'sm' ? 'h-6 w-6 rounded-[7px] text-[11px]' : 'h-9 w-9 rounded-[11px] text-[15px]'
  return (
    <span className={`grid place-items-center bg-navy-900 font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_6px_14px_-6px_rgba(10,25,47,0.6)] ${box}`} aria-hidden>
      F
    </span>
  )
}
