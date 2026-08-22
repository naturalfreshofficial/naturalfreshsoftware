"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";

export default function PWAUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {

        // Periodically check for SW updates every 15 minutes
        setInterval(() => {
          registration.update().catch(() => {});
        }, 15 * 60 * 1000);

        // Check if there is already a waiting worker on registration
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
        }

        // Listen for new workers
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                setWaitingWorker(newWorker);
                setUpdateAvailable(true);
                // Trigger skipWaiting automatically
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn("SW Registration issue:", err);
      });

    // Auto reload when controller changes (i.e. new SW takes over)
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900 text-white p-3.5 rounded-[8px] shadow-2xl border border-blue-500/40 flex items-center gap-3 max-w-sm">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white">Update Available</p>
          <p className="text-[10px] text-slate-300">A new version of Natural Fresh is ready.</p>
        </div>
        <button
          type="button"
          onClick={handleUpdate}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-[5px] text-xs font-bold text-white shrink-0 flex items-center gap-1 shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Update</span>
        </button>
      </div>
    </div>
  );
}
