import { useEffect, useRef } from "react";
import { useUIStore } from "../store/uiStore";
import { rtdb } from "../lib/firebase";
import { ref, onValue, set } from "firebase/database";

const BUTTON_KEY_MAP: Record<string, { key: string; code: string; keyCode: number }> = {
  UP: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
  DOWN: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
  LEFT: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
  RIGHT: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
  A: { key: "x", code: "KeyX", keyCode: 88 },
  B: { key: "z", code: "KeyZ", keyCode: 90 },
  X: { key: "s", code: "KeyS", keyCode: 83 },
  Y: { key: "a", code: "KeyA", keyCode: 65 },
  SELECT: { key: "c", code: "KeyC", keyCode: 67 },
  START: { key: "Enter", code: "Enter", keyCode: 13 },
  L1: { key: "q", code: "KeyQ", keyCode: 81 },
  R1: { key: "w", code: "KeyW", keyCode: 87 }
};

export function simulateKey(state: "down" | "up", button: string) {
  const mapping = BUTTON_KEY_MAP[button];
  if (!mapping) return;

  const eventType = state === "down" ? "keydown" : "keyup";
  const eventInit: KeyboardEventInit = {
    key: mapping.key,
    code: mapping.code,
    keyCode: mapping.keyCode,
    which: mapping.keyCode,
    bubbles: true,
    cancelable: true,
  };

  // Dispatch on the main window
  const outerEvent = new KeyboardEvent(eventType, eventInit);
  window.dispatchEvent(outerEvent);

  // Dispatch on any emulator iframe window
  const iframe = document.querySelector("iframe");
  if (iframe && iframe.contentWindow) {
    const win = iframe.contentWindow as any;
    try {
      if (win.KeyboardEvent) {
        const innerEvent = new win.KeyboardEvent(eventType, eventInit);
        iframe.contentWindow.dispatchEvent(innerEvent);
      } else {
        const fallbackEvent = new KeyboardEvent(eventType, eventInit);
        iframe.contentWindow.dispatchEvent(fallbackEvent);
      }
    } catch (err) {
      // Fallback if the iframe constructor is restricted
      const fallbackEvent = new KeyboardEvent(eventType, eventInit);
      iframe.contentWindow.dispatchEvent(fallbackEvent);
    }
  }
}

export function useMobileRemoteController() {
  const { controllerCode, controllerCodeP2, setControllerConnected, setControllerConnectedP2 } = useUIStore();
  const prevStatesRef = useRef<Record<string, "down" | "up">>({});
  const prevStatesP2Ref = useRef<Record<string, "down" | "up">>({});

  // Helper to sync to iframe virtual Gamepads natively
  const sendToIframeGamepad = (playerIndex: number, button: string, state: "down" | "up") => {
    const iframe = document.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'GAMEPAD_UPDATE', player: playerIndex, button, state }, '*');
    }
  };

  useEffect(() => {
    // ---- PLAYER 1 LOGIC ----
    if (controllerCode) {
      const connectedRef = ref(rtdb, `controllers/${controllerCode}/connected`);
      const stateRef = ref(rtdb, `controllers/${controllerCode}/state`);

      set(connectedRef, null);
      set(stateRef, null);

      const unsubConnection = onValue(connectedRef, (snap) => setControllerConnected(snap.val() === true));
      
      const unsubState = onValue(stateRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.val();
        const buttons = ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "X", "Y", "SELECT", "START", "L1", "R1"];
        buttons.forEach((btn) => {
          const currentVal = data[btn] || "up";
          if (currentVal !== (prevStatesRef.current[btn] || "up")) {
            simulateKey(currentVal, btn); // Legacy Keyboard Fallback
            sendToIframeGamepad(0, btn, currentVal); // Native Virtual Gamepad P1
            prevStatesRef.current[btn] = currentVal;
          }
        });
      });

      // Cleanup
      (window as any).cleanupP1 = () => {
        set(connectedRef, null);
        set(stateRef, null);
        unsubConnection();
        unsubState();
      };
    }

    // ---- PLAYER 2 LOGIC ----
    if (controllerCodeP2) {
      const connectedP2Ref = ref(rtdb, `controllers/${controllerCodeP2}/connected`);
      const stateP2Ref = ref(rtdb, `controllers/${controllerCodeP2}/state`);

      set(connectedP2Ref, null);
      set(stateP2Ref, null);

      const unsubConnectionP2 = onValue(connectedP2Ref, (snap) => setControllerConnectedP2(snap.val() === true));
      
      const unsubStateP2 = onValue(stateP2Ref, (snap) => {
        if (!snap.exists()) return;
        const data = snap.val();
        const buttons = ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "X", "Y", "SELECT", "START", "L1", "R1"];
        buttons.forEach((btn) => {
          const currentVal = data[btn] || "up";
          if (currentVal !== (prevStatesP2Ref.current[btn] || "up")) {
            sendToIframeGamepad(1, btn, currentVal); // Native Virtual Gamepad P2
            prevStatesP2Ref.current[btn] = currentVal;
          }
        });
      });

      // Cleanup
      (window as any).cleanupP2 = () => {
        set(connectedP2Ref, null);
        set(stateP2Ref, null);
        unsubConnectionP2();
        unsubStateP2();
      };
    }

    return () => {
      if ((window as any).cleanupP1) { (window as any).cleanupP1(); setControllerConnected(false); }
      if ((window as any).cleanupP2) { (window as any).cleanupP2(); setControllerConnectedP2(false); }
    };
  }, [controllerCode, controllerCodeP2, setControllerConnected, setControllerConnectedP2]);
}
