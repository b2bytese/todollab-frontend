import { cn } from '@/lib/utils';

export function B2byteSignature({ className }: { className?: string }) {
  return (
    <a
      href="https://b2byte.com/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="B2byte Software Engineering — produto proprietário do Todollab"
      className={cn(
        'group inline-flex items-center justify-between gap-6 w-full max-w-xs border-b border-editorial-border pb-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2 focus-visible:ring-offset-editorial-bg rounded-sm',
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-editorial-muted">
          UM PRODUTO
        </span>
        <span className="font-display text-[2.25rem] font-normal tracking-[-0.055em] leading-none text-editorial-fg group-hover:text-brand-coral transition-colors duration-200">
          B2byte
        </span>
        <span className="text-[11px] tracking-[0.08em] text-editorial-muted">
          Software Engineering
        </span>
      </div>
      <span className="text-xl text-editorial-muted group-hover:text-brand-coral transition-colors duration-200 self-center">
        ↗
      </span>
    </a>
  );
}
