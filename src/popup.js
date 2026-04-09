/**
 * Popup script - Dashboard entry point
 * Opens the dashboard page for task management
 *
 * @version 4.0.0 - Dashboard (Variant C sidebar layout)
 */

document.addEventListener("DOMContentLoaded", async () => {
  const btnDiagnostic = document.getElementById("btn-diagnostic");

  // === Open dashboard page ===
  btnDiagnostic.addEventListener("click", async () => {
    try {
      // Check if dashboard is already open
      const allTabs = await chrome.tabs.query({});
      const existingTab = allTabs.find(tab =>
        tab.url && tab.url.includes(chrome.runtime.getURL("dashboard.html"))
      );

      if (existingTab) {
        // Focus on existing tab
        await chrome.tabs.update(existingTab.id, { active: true });
        await chrome.windows.update(existingTab.windowId, { focused: true });
        return;
      }

      // Get current tab position
      const [currentTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Open dashboard in new tab
      await chrome.tabs.create({
        url: chrome.runtime.getURL("dashboard.html"),
        index: currentTab.index + 1,
        active: true,
      });

    } catch (error) {
      console.error("[Popup] Error opening dashboard:", error);
      alert("Error: " + error.message);
    }
  });

});
