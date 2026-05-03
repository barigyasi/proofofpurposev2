import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface Props {
  onResult: (text: string) => void;
  onError?: (err: string) => void;
}

export function QRScanner({ onResult, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const id = `qr-${Math.random().toString(36).slice(2)}`;
    ref.current.id = id;
    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;
    let active = true;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          if (!active) return;
          active = false;
          onResult(decoded);
        },
        () => {},
      )
      .catch((e) => onError?.(String(e)));

    return () => {
      scanner.stop().catch(() => {});
      scanner.clear().catch(() => {});
    };
  }, []);

  return <div ref={ref} className="brutal mx-auto w-full max-w-sm overflow-hidden" />;
}
