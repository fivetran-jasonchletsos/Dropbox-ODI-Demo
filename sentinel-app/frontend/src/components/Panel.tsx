import clsx from 'clsx';
import React from 'react';

interface Props extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: string;
  title?: React.ReactNode;
  right?: React.ReactNode;
  bodyClassName?: string;
}

export default function Panel({ eyebrow, title, right, bodyClassName, className, children, ...rest }: Props) {
  return (
    <div className={clsx('panel', className)} {...rest}>
      {(title || eyebrow || right) && (
        <div className="panel-header">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <div className="font-display text-[15px] font-semibold text-slate-100 mt-0.5">{title}</div>}
          </div>
          {right && <div className="text-[11px] text-slate-400">{right}</div>}
        </div>
      )}
      <div className={clsx('p-5', bodyClassName)}>{children}</div>
    </div>
  );
}
