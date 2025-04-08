importScripts('jszip.min.js');

let savedCount = 0;
const savedSources = new Map();
let zip = undefined;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startLoad') {
    startLoad(message.tabId)
  } else if (message.action === 'endLoad') {
    endLoad(message.tabId).then(() => {
      const data = {
        saved: savedCount,
        loaded: savedSources.size,
      }
      sendResponse(data);
  })
  } else if (message.action === 'getLoadData') {
    const data = {
      saved: savedCount,
      loaded: savedSources.size,
    }
    sendResponse(data);
  } else if (message.action === 'download') {
    download()
    chrome.action.setBadgeText({ text: '✓', tabId: message.tabId });
    detachDebugger(message.tabId)
  }
});

async function startLoad(tabId) {
  savedCount = 0
  zip = new JSZip()
  await chrome.debugger.attach({ tabId }, "1.3");
  
  await sendDebuggerCommand(tabId, 'Debugger.enable');

  chrome.debugger.onEvent.addListener((tab, eventName, script) => {
    
    if (eventName === 'Debugger.scriptParsed' && script.scriptLanguage === 'JavaScript') {
      savedSources.set(script.url,script)
    } else {
      console.log(eventName, script)
    }
  })
}

async function endLoad(tabId) {
    for (const [url, script] of savedSources) {
      try {
        const base64Data =  script.sourceMapURL.split(',')[1];
        if (base64Data) {
          const jsonString = atob(base64Data);
          const jsonObject = JSON.parse(jsonString);
          zip.file(url, jsonObject.sourcesContent.join(''));
        }
      } catch (error) {
          console.error("Data error:", error);
          continue
      }
      savedCount++;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
}

async function download() {
  const zipContent = await zip.generateAsync({
    type: 'base64',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  
  const blobUrl = `data:application/zip;base64,${zipContent}`;
  await chrome.downloads.download({
    url: blobUrl,
    filename: 'sources.zip'
  });
  
}

async function detachDebugger(tabId) {
  try {
    await chrome.debugger.detach({ tabId });
  } catch (e) {
    //
  }
}

function sendDebuggerCommand(tabId, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}
