// js/modules/album-sort.js
// Ручная сортировка фото в альбоме через drag-n-drop.

import { db } from "../firebase-init.js";
import { doc, updateDoc, writeBatch }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentUser } from "../core/state.js";
import { toast } from "../core/utils.js";
import { canEdit } from "./gestion.js";

let dragSrcId = null;
let currentAlbumPhotos = [];

/**
 * Настраивает перетаскивание карточек в #albumGrid.
 * @param {Array} photos — текущий массив фото в альбоме
 * @param {Function} onReorder — колбэк после успешного пересохранения
 */
export function setupAlbumSort(photos, onReorder) {
  currentAlbumPhotos = photos;

  const grid = document.getElementById("albumGrid");
  if (!grid) return;
  if (!canEdit()) return;

  const cards = grid.querySelectorAll(".photo-card");
  if (cards.length < 2) return;

  cards.forEach(card => {
    card.draggable = true;

    card.addEventListener("dragstart", (e) => {
      dragSrcId = card.dataset.photoId;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragSrcId);
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      grid.querySelectorAll(".photo-card").forEach(c => c.classList.remove("drag-over"));
      dragSrcId = null;
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (card.dataset.photoId !== dragSrcId) {
        card.classList.add("drag-over");
      }
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-over");
    });

    card.addEventListener("drop", async (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");

      const targetId = card.dataset.photoId;
      if (!dragSrcId || dragSrcId === targetId) return;

      // Меняем порядок в DOM
      const srcCard = grid.querySelector('[data-photo-id="' + dragSrcId + '"]');
      if (!srcCard) return;

      const allCards = Array.from(grid.querySelectorAll(".photo-card"));
      const srcIdx = allCards.indexOf(srcCard);
      const tgtIdx = allCards.indexOf(card);

      if (srcIdx < tgtIdx) {
        card.parentNode.insertBefore(srcCard, card.nextSibling);
      } else {
        card.parentNode.insertBefore(srcCard, card);
      }

      // Собираем новый порядок
      const newOrder = Array.from(grid.querySelectorAll(".photo-card"))
        .map(c => c.dataset.photoId);

      await saveOrder(newOrder, onReorder);
    });
  });
}

async function saveOrder(orderedIds, onReorder) {
  const me = getCurrentUser();
  if (!me) return;

  try {
    const batch = writeBatch(db);
    const base = Date.now();

    orderedIds.forEach((id, idx) => {
      const ref = doc(db, "album_photos", id);
      batch.update(ref, { order: base + idx });
    });

    await batch.commit();
    toast("Порядок сохранён", "ok");

    // Обновляем локальный кэш
    orderedIds.forEach((id, idx) => {
      const p = currentAlbumPhotos.find(x => x.id === id);
      if (p) p.order = base + idx;
    });

    if (onReorder) onReorder();
  } catch (e) {
    toast("Ошибка сохранения порядка: " + e.message, "warn");
  }
}
