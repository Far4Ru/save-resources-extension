importScripts('jszip.min.js');
importScripts('buffer@6.0.3.js');

let savedCount = 0;
const savedSources = new Map();
const savedNetworkSources = new Map();
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
  await sendDebuggerCommand(tabId, 'Network.enable');

  chrome.debugger.onEvent.addListener((tab, eventName, script) => {
    
    if (eventName === 'Debugger.scriptParsed' && script.scriptLanguage === 'JavaScript') {
      savedSources.set(script.url,script)
    } else if (eventName === 'Network.responseReceived') {
      const { response, requestId, url } = script
      const result = sendDebuggerCommand(tabId, 'Network.getResponseBody', { requestId })
      result.then(resBody => {
        const content = resBody.base64Encoded ? buffer.Buffer.from(resBody.body, 'base64') : resBody.body;
        savedNetworkSources.set(resolveURLToPath(response.url).path, content)
      })
    } else {
      console.log(eventName, script)
    }
  })

}

async function endLoad(tabId) {
  for (const [url, script] of savedNetworkSources) {
    try {
        zip.file(url, script);
    } catch (error) {
        console.error("Data error:", error);
        continue
    } 
    await new Promise(resolve => setTimeout(resolve, 0));
  }
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
const resolveURLToPath = (cUrl) => {
  let filepath, filename, isDataURI;
  let foundIndex = cUrl.search(/:\/\//);
  // Check the url whether it is a link or a string of text data
  if (foundIndex === -1 || foundIndex >= 10) {
      isDataURI = true;
      console.log('[DEVTOOL]', 'Data URI Detected!!!!!');
      // Data URI
      if (cUrl.indexOf('data:') === 0) {
          let dataURIInfo = cUrl
              .split(';')[0]
              .split(',')[0]
              .substring(0, 30)
              .replace(/[^A-Za-z0-9]/g, '.');
          filename = dataURIInfo + '.' + Math.random().toString(16).substring(2) + '.txt';
      } else {
          filename = 'data.' + Math.random().toString(16).substring(2) + '.txt';
      }
      filepath = '_DataURI/' + filename;
  } else {
      isDataURI = false;
      if (cUrl.split('://')[0].includes('http')) {
          // For http:// https://
          filepath = cUrl.split('://')[1].split('?')[0];
      } else {
          // For webpack:// ng:// ftp:// will be webpack--- ng--- ftp---
          filepath = cUrl.replace('://', '---').split('?')[0];
      }
      if (filepath.charAt(filepath.length - 1) === '/') {
          filepath = filepath + 'index.html';
      }
      filename = filepath.substring(filepath.lastIndexOf('/') + 1);
  }

  // Get Rid of QueryString after ;
  filename = filename.split(';')[0];
  filepath = filepath.substring(0, filepath.lastIndexOf('/') + 1) + filename;

  // Remove path violation case
  filepath = filepath
      .replace(/:|\\|=|\*|\.$|"|'|\?|~|\||<|>/g, '')
      .replace(/\/\//g, '/')
      .replace(/(\s|\.)\//g, '/')
      .replace(/\/(\s|\.)/g, '/');

  filename = filename.replace(/:|\\|=|\*|\.$|"|'|\?|~|\||<|>/g, '');

  // Decode URI
  if (filepath.indexOf('%') !== -1) {
      try {
          filepath = decodeURIComponent(filepath);
          filename = decodeURIComponent(filename);
      } catch (err) {
          console.log('[DEVTOOL]', err);
      }
  }

  // Strip double slashes ---
  while (filepath.includes('//')) {
      filepath = filepath.replace('//', '/');
  }

  // Strip the first slash '/src/...' -> 'src/...'
  if (filepath.charAt(0) === '/') {
      filepath = filepath.slice(1);
  }

  return {
      path: filepath,
      name: filename,
      dataURI: isDataURI && cUrl,
  };
};