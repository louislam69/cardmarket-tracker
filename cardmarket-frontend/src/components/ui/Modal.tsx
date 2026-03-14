import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, children }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-[90vw] max-w-4xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-gray-900 m-0">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none cursor-pointer bg-transparent border-none p-0"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
