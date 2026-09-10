import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

export function Modal({ title, eyebrow, children, onClose, wide = false }: {
  title: string; eyebrow: string; children: ReactNode; onClose: () => void; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog ref={ref} className={`modal ${wide ? "modal-wide" : ""}`} aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <header className="modal-heading">
        <div><p className="eyebrow">{eyebrow}</p><h2 id={titleId}>{title}</h2></div>
        <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" size={19} /></button>
      </header>
      {children}
    </dialog>
  );
}
