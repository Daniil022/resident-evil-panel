// js/core/perf.js
export function debounce(fn, ms = 200) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

export function throttle(fn, ms = 100) {
  let last = 0;
  let t = null;
  return function (...args) {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn.apply(this, args);
    } else {
      clearTimeout(t);
      t = setTimeout(() => {
        last = Date.now();
        fn.apply(this, args);
      }, ms - (now - last));
    }
  };
}

export function raf(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}
