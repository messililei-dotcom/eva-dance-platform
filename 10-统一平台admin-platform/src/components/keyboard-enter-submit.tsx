'use client';

import { useEffect } from 'react';

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.offsetParent !== null;
}

function shouldKeepNativeEnter(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('[data-enter-submit="off"]')) return true;
  if (target.isContentEditable) return true;
  if (target.tagName === 'TEXTAREA') return true;
  return false;
}

function clickPrimaryButton(container: ParentNode) {
  const buttons = Array.from(
    container.querySelectorAll<HTMLButtonElement>('.ant-btn-primary:not([disabled])'),
  ).filter(isVisible);
  const button = buttons[buttons.length - 1];
  if (!button) return false;
  button.click();
  return true;
}

function submitContainingForm(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const form = target.closest('form') as HTMLFormElement | null;
  if (!form) return false;
  if (typeof form.requestSubmit === 'function') {
    form.requestSubmit();
  } else {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
  return true;
}

export function KeyboardEnterSubmit() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'Enter'
        || event.isComposing
        || event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || event.shiftKey
        || shouldKeepNativeEnter(event.target)
      ) {
        return;
      }

      const target = event.target instanceof HTMLElement ? event.target : null;
      const popover = target?.closest('.ant-popover') as HTMLElement | null;
      if (popover && clickPrimaryButton(popover)) {
        event.preventDefault();
        return;
      }

      const modalWraps = Array.from(document.querySelectorAll<HTMLElement>('.ant-modal-wrap'))
        .filter(isVisible);
      const modal = modalWraps[modalWraps.length - 1];
      if (modal && (!target || modal.contains(target) || target === document.body)) {
        if (clickPrimaryButton(modal)) {
          event.preventDefault();
          return;
        }
      }

      if (submitContainingForm(event.target)) {
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

  return null;
}
