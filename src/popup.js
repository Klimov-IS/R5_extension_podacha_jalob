/**
 * Popup script - упрощённая версия
 * Только открытие страницы подачи жалоб
 *
 * @version 2.0.0 - Simplified
 */

document.addEventListener("DOMContentLoaded", async () => {
  const btnReview = document.getElementById("btn-review");
  const btnDiagnostic = document.getElementById("btn-diagnostic");

  // === Открытие страницы подачи жалоб ===
  btnReview.addEventListener("click", async () => {
    try {
      // Проверяем, открыта ли уже страница подачи жалоб
      const allTabs = await chrome.tabs.query({});
      const existingComplaintsTab = allTabs.find(tab =>
        tab.url && tab.url.includes(chrome.runtime.getURL("complaints-page.html"))
      );

      if (existingComplaintsTab) {
        // Если страница уже открыта - фокусируемся на ней
        await chrome.tabs.update(existingComplaintsTab.id, { active: true });
        await chrome.windows.update(existingComplaintsTab.windowId, { focused: true });
        return;
      }

      // Получаем текущую активную вкладку для определения позиции
      const [currentTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Открываем страницу подачи жалоб в новой вкладке
      await chrome.tabs.create({
        url: chrome.runtime.getURL("complaints-page.html"),
        index: currentTab.index + 1,
        active: true,
      });

      console.log("✅ Страница подачи жалоб открыта");
    } catch (error) {
      console.error("Ошибка открытия страницы подачи жалоб:", error);
      alert("❌ Ошибка: " + error.message);
    }
  });

  // === Открытие диагностической страницы ===
  btnDiagnostic.addEventListener("click", async () => {
    try {
      // Проверяем, открыта ли уже страница диагностики
      const allTabs = await chrome.tabs.query({});
      const existingDiagnosticTab = allTabs.find(tab =>
        tab.url && tab.url.includes(chrome.runtime.getURL("diagnostic.html"))
      );

      if (existingDiagnosticTab) {
        // Если страница уже открыта - фокусируемся на ней
        await chrome.tabs.update(existingDiagnosticTab.id, { active: true });
        await chrome.windows.update(existingDiagnosticTab.windowId, { focused: true });
        return;
      }

      // Получаем текущую активную вкладку для определения позиции
      const [currentTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Открываем диагностическую страницу в новой вкладке
      await chrome.tabs.create({
        url: chrome.runtime.getURL("diagnostic.html"),
        index: currentTab.index + 1,
        active: true,
      });

      console.log("✅ Диагностическая страница открыта");
    } catch (error) {
      console.error("Ошибка открытия диагностической страницы:", error);
      alert("❌ Ошибка: " + error.message);
    }
  });

  console.log('[Popup] ✅ Расширение готово');
});
