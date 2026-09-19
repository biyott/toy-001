import type { InputFrame } from './types';

export function createInput() {
  const held = new Set<string>();
  let dash = false, pause = false;
  const ignored = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  const controlled = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','Escape','KeyP']);
  const keydown = (event: KeyboardEvent) => {
    if (ignored(event.target) || !controlled.has(event.code)) return;
    if (event.code !== 'Escape') event.preventDefault();
    if (!event.repeat) {
      if (event.code === 'Space' || event.code.startsWith('Shift')) dash = true;
      if (event.code === 'Escape' || event.code === 'KeyP') pause = true;
    }
    held.add(event.code);
  };
  const keyup = (event: KeyboardEvent) => { held.delete(event.code); };
  const clear = () => { held.clear(); dash = false; pause = false; };
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', clear);
  return {
    read(): InputFrame {
      let x = Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft'));
      let y = Number(held.has('KeyS') || held.has('ArrowDown')) - Number(held.has('KeyW') || held.has('ArrowUp'));
      const length = Math.hypot(x,y); if(length>1){x/=length;y/=length;}
      const frame = { moveX:x, moveY:y, dashPressed:dash, pausePressed:pause }; dash=false;pause=false; return frame;
    },
    clear,
    diagnostics: () => ({ heldKeys: [...held], listenerCount: 3 }),
    dispose() { window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clear);clear(); },
  };
}
