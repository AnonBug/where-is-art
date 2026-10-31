import { useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";

interface Props {
  id: string;
  labelledBy: string;
  closeLabel: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}

// Mounting owns showModal(); unmounting releases the browser's modal focus trap.
export function Modal({
  id,
  labelledBy,
  closeLabel,
  className,
  onClose,
  children,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  function handleBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      id={id}
      className={className}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdrop}
    >
      <button className="close" onClick={onClose} aria-label={closeLabel}>
        ×
      </button>
      {children}
    </dialog>
  );
}
