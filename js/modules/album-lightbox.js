// js/modules/album-lightbox.js
// Полноэкранный просмотр фото с навигацией.

let currentPhotos = [];
let currentIndex = 0;
let overlay = null;
let keyHandler = null;
let touchStartX = 0;

export function openLightbox(photos, startIndex) {
  if (!photos || photos.length === 0) return;

  currentPhotos = photos;
  currentIndex = Math.max(0, Math.min(startIndex || 0, photos.length - 1));

  if (!overlay) createOverlay();
  updateImage();

  overlay.classList.add("active");
  document.body.style.overflow = "hidden";

  keyHandler = (e) => {
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === "ArrowRight") next();
  };
  document.addEventListener("keydown", keyHandler);

  overlay.addEventListener("touchstart", onTouchStart, { passive: true });
  overlay.addEventListener("touchend", onTouchEnd, { passive: true });
}

export function closeLightbox() {
  if (!overlay) return;
  overlay.classList.remove("active");
  document.body.style.overflow = "";
  if (keyHandler) {
    document.removeEventListener("keydown", keyHandler);
    keyHandler = null;
  }
  overlay.removeEventListener("touchstart", onTouchStart);
  overlay.removeEventListener("touchend", onTouchEnd);
}

function createOverlay() {
  overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.innerHTML =
    '<button class="lb-close" title="Закрыть (Esc)">✕</button>' +
    '<button class="lb-prev" title="Назад (←)">‹</button>' +
    '<button class="lb-next" title="Вперёд (→)">›</button>' +
    '<div class="lb-stage">' +
      '<img class="lb-img" alt="">' +
    '</div>' +
    '<div class="lb-caption">' +
      '<div class="lb-title"></div>' +
      '<div class="lb-counter"></div>' +
    '</div>';

  overlay.querySelector(".lb-close").onclick = closeLightbox;
  overlay.querySelector(".lb-prev").onclick = (e) => { e.stopPropagation(); prev(); };
  overlay.querySelector(".lb-next").onclick = (e) => { e.stopPropagation(); next(); };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeLightbox();
  });

  document.body.appendChild(overlay);
}

function updateImage() {
  if (!overlay) return;
  const p = currentPhotos[currentIndex];
  if (!p) return;

  const img = overlay.querySelector(".lb-img");
  img.src = p.url;
  img.alt = p.title || "Фото";

  const title = overlay.querySelector(".lb-title");
  const counter = overlay.querySelector(".lb-counter");
  title.textContent = p.title || "";
  counter.textContent = (currentIndex + 1) + " / " + currentPhotos.length;

  // Скрываем стрелки, если одно фото
  const prev = overlay.querySelector(".lb-prev");
  const next = overlay.querySelector(".lb-next");
  const multi = currentPhotos.length > 1;
  prev.style.display = multi ? "" : "none";
  next.style.display = multi ? "" : "none";
}

function prev() {
  if (currentPhotos.length <= 1) return;
  currentIndex = (currentIndex - 1 + currentPhotos.length) % currentPhotos.length;
  updateImage();
}

function next() {
  if (currentPhotos.length <= 1) return;
  currentIndex = (currentIndex + 1) % currentPhotos.length;
  updateImage();
}

function onTouchStart(e) {
  touchStartX = e.changedTouches[0].clientX;
}
function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) < 50) return;
  if (dx > 0) prev();
  else next();
}
