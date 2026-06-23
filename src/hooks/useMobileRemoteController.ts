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

function simulateKey(state: "down" | "up", button: string) {
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
  window.dispatchEvent(new KeyboardEvent(eventType, eventInit));

  const iframe = document.querySelector("iframe");
  if (iframe && iframe.contentWindow) {
    try {
      const win = iframe.contentWindow as any;
      const Ctor = win.KeyboardEvent || KeyboardEvent;
      iframe.contentWindow.dispatchEvent(new Ctor(eventType, eventInit));
    } catch {
      iframe.contentWindow.dispatchEvent(new KeyboardEvent(eventType, eventInit));
    }
  }
}

function sendToIframeGamepad(playerIndex: number, button: string, state: "down" | "up") {
  const iframe = document.querySelector("iframe");
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({ type: 'GAMEPAD_UPDATE', player: playerIndex, button, state }, '*');
  }
}

function listenToController(
  code: string,
  playerIndex: number,
  setConnected: (c: boolean) => void,
  prevRef: React.MutableRefObject<Record<string, "down" | "up">>,
  enableKeyboard: boolean
) {
  const connectedRef = ref(rtdb, `controllers/${code}/connected`);
  const stateRef = ref(rtdb, `controllers/${code}/state`);

  set(connectedRef, null);
  set(stateRef, null);

  const unsubConnection = onValue(connectedRef, (snap) => setConnected(snap.val() === true));

  const unsubState = onValue(stateRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.val();
    const buttons = ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "X", "Y", "SELECT", "START", "L1", "R1"];
    buttons.forEach((btn) => {
      const currentVal = data[btn] || "up";
      if (currentVal !== (prevRef.current[btn] || "up")) {
        if (enableKeyboard) {
          simulateKey(currentVal, btn);
        }
        sendToIframeGamepad(playerIndex, btn, currentVal);
        prevRef.current[btn] = currentVal;
      }
    });
  });

  return () => {
    set(connectedRef, null);
    set(stateRef, null);
    unsubConnection();
    unsubState();
  };
}

export function useMobileRemoteController() {
  const { controllerCode, controllerCodeP2, setControllerConnected, setControllerConnectedP2 } = useUIStore();
  const prevP1 = useRef<Record<string, "down" | "up">>({});
  const prevP2 = useRef<Record<string, "down" | "up">>({});

  useEffect(() => {
    const cleanups: (() => void)[] = [];

    if (controllerCode) {
      cleanups.push(listenToController(controllerCode, 0, setControllerConnected, prevP1, true));
    }
    if (controllerCodeP2) {
      cleanups.push(listenToController(controllerCodeP2, 1, setControllerConnectedP2, prevP2, true));
    }

    return () => {
      cleanups.forEach(fn => fn());
      setControllerConnected(false);
      setControllerConnectedP2(false);
    };
  }, [controllerCode, controllerCodeP2, setControllerConnected, setControllerConnectedP2]);
}
