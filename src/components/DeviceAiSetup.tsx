import { useEffect, useState } from "react";
import { deviceStatus, prepareDevice, type DeviceStatus } from "../lib/ondevice";
import { updateSettings, useSettings } from "../lib/settings";
import { errorText } from "../lib/format";

const STATUS_TEXT: Record<DeviceStatus, string> = {
  available: "Ready on this device.",
  downloadable: "Needs a one-time download of the model (a few GB, over Wi-Fi is best).",
  downloading: "The browser is downloading the model.",
  unavailable: "This device doesn't meet the browser's requirements for built-in AI.",
  unsupported: "This browser doesn't have built-in AI yet. It works in desktop Chrome 148 and later.",
};

/** Checks, downloads and switches on the browser's built-in model. */
export function DeviceAiSetup({ compact = false }: { compact?: boolean }) {
  const s = useSettings();
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    deviceStatus().then(setStatus);
  }, []);

  async function enable() {
    setError(null);
    if (status !== "available") {
      setProgress(0);
      try {
        await prepareDevice(setProgress);
      } catch (e) {
        setError(errorText(e, "The download didn't finish. Try again."));
        setProgress(null);
        return;
      }
      setProgress(null);
      setStatus(await deviceStatus());
    }
    updateSettings({ aiMode: "device" });
  }

  if (status === null) return null;
  const usable = status === "available" || status === "downloadable" || status === "downloading";
  const on = s.aiMode === "device";

  return (
    <div className="device-ai">
      {!(compact && !usable) && <p className={usable ? "muted" : "fine"}>{STATUS_TEXT[status]}</p>}
      {usable && !on && (
        <button type="button" className="btn btn-primary" onClick={enable} disabled={progress !== null}>
          {progress !== null ? `Downloading… ${Math.round(progress * 100)}%` : status === "available" ? "Use on-device AI" : "Download and turn on"}
        </button>
      )}
      {on && !compact && <p className="ok">On-device AI is on. Nothing you type leaves this device.</p>}
      {progress !== null && <progress className="progress" value={progress} max={1} aria-label="Model download" />}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
