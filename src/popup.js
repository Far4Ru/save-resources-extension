document.addEventListener("DOMContentLoaded", () => {
    const controlButton = document.getElementById("controlButton");
    const progressBar = document.getElementById("progressBar");
    const timeDisplay = document.getElementById("timeDisplay");
    
    let intervalId = null;
    let currentTabId = null;
  
    // Get current tab ID
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
            currentTabId = tabs[0].id;
            checkLoadStatus();
        }
    });
  
    controlButton.addEventListener("click", async () => {
        if (controlButton.textContent === "Start") {
            // Start tracking
            controlButton.textContent = "Stop";
            downloadButton.disabled = true;
            chrome.action.setBadgeText({ text: "", tabId: currentTabId });
        
            // Reload the page
            if (currentTabId) {
                chrome.tabs.reload(currentTabId, { bypassCache: true });
                chrome.runtime.sendMessage({
                    action: "startLoad",
                    tabId: currentTabId,
                });
            }
        } else if (controlButton.textContent === "Stop") {
            // Stop tracking
            controlButton.textContent = "Loading";
            controlButton.disabled = true;
        
            if (currentTabId) {
                chrome.runtime.sendMessage({
                    action: "endLoad",
                    tabId: currentTabId,
                });
          
                // Start checking load status
                intervalId = setInterval(checkLoadStatus, 100);
            }
        } else if (controlButton.textContent === "Download") {
            // Stop tracking
            controlButton.textContent = "Start";
            controlButton.disabled = false;
            
            if (currentTabId) {
                chrome.runtime.sendMessage({
                    action: "download",
                    tabId: currentTabId,
                });
            }
        }
    });
  
    downloadButton.addEventListener("click", async () => {
        // Stop tracking
        controlButton.textContent = "Start";
        controlButton.disabled = false;
        downloadButton.disabled = true;
        progressBar.style.width = "0%";
        timeDisplay.textContent = "";
        
        if (currentTabId) {
            chrome.runtime.sendMessage({
                action: "download",
                tabId: currentTabId,
            });
        }
    });
  
    function checkLoadStatus() {
        if (!currentTabId) {
            return;
        }
      
        chrome.runtime.sendMessage(
            {action: "getLoadData", tabId: currentTabId},
            (data) => {
                if (!data) {
                    return;
                }
                if (data.loaded !== data.saved) {
                    controlButton.textContent = "Stop";
                    downloadButton.disabled = true;
                    chrome.action.setBadgeText({ text: "", tabId: currentTabId });
                }
          
                if (data.saved >= data.loaded && data.loaded !== 0) {
                    // Load completed
                    clearInterval(intervalId);
                    progressBar.style.width = "100%";
                    downloadButton.textContent = "Download";
                    downloadButton.disabled = false;
                } else if (intervalId) {
                    // In progress
                    const elapsed = data.saved;
                    const estimatedLoadTime = data.loaded;
                    const progress = Math.min(100, (elapsed / estimatedLoadTime) * 100);
                    progressBar.style.width = `${progress}%`;
                }
            },
        );
    }
});
