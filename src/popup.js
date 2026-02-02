/**
 * Popup script - Diagnostic entry point
 * Opens the diagnostic page for complaint submission workflow
 *
 * @version 3.0.0 - Single button (diagnostic only)
 */

document.addEventListener("DOMContentLoaded", async () => {
  const btnDiagnostic = document.getElementById("btn-diagnostic");

  // === Open diagnostic page ===
  btnDiagnostic.addEventListener("click", async () => {
    try {
      // Check if diagnostic page is already open
      const allTabs = await chrome.tabs.query({});
      const existingDiagnosticTab = allTabs.find(tab =>
        tab.url && tab.url.includes(chrome.runtime.getURL("diagnostic.html"))
      );

      if (existingDiagnosticTab) {
        // Focus on existing tab
        await chrome.tabs.update(existingDiagnosticTab.id, { active: true });
        await chrome.windows.update(existingDiagnosticTab.windowId, { focused: true });
        return;
      }

      // Get current tab position
      const [currentTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Open diagnostic page in new tab
      await chrome.tabs.create({
        url: chrome.runtime.getURL("diagnostic.html"),
        index: currentTab.index + 1,
        active: true,
      });

      console.log("[Popup] Diagnostic page opened");
    } catch (error) {
      console.error("[Popup] Error opening diagnostic page:", error);
      alert("Error: " + error.message);
    }
  });

  console.log('[Popup] Extension ready');
});
