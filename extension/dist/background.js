// src/browser/pdfSource.ts
function extractViewerSrc(url) {
  if (!url.startsWith("chrome-extension://") && !url.startsWith("edge-extension://")) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const src = parsed.searchParams.get("src");
    return src ? decodeURIComponent(src) : null;
  } catch {
    return null;
  }
}
function resolvePdfSourceFromTab(tab) {
  const url = tab.url?.trim();
  if (!url) return null;
  const viewerSrc = extractViewerSrc(url);
  if (viewerSrc) {
    return { kind: "viewer-src", url: viewerSrc };
  }
  if (/\.pdf(?:$|[?#])/i.test(url)) {
    return { kind: "direct-url", url };
  }
  return null;
}
function inferPdfSourceFromProbe(probe) {
  const candidate = probe?.embedSrc || probe?.iframeSrc || probe?.anchorHref;
  if (!candidate) return null;
  return { kind: "embedded-src", url: candidate };
}

// src/background.ts
async function probePageForPdf(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const embed = document.querySelector('embed[type="application/pdf"], embed[src$=".pdf"]');
      const iframe = document.querySelector('iframe[src$=".pdf"], iframe[type="application/pdf"]');
      const anchor = document.querySelector('a[href$=".pdf"]');
      return {
        embedSrc: embed?.src,
        iframeSrc: iframe?.src,
        anchorHref: anchor?.href
      };
    }
  });
  return result;
}
async function resolveCurrentTabPdf() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("\u672A\u627E\u5230\u5F53\u524D\u6807\u7B7E\u9875");
  }
  const direct = resolvePdfSourceFromTab({ url: tab.url });
  if (direct) {
    const fileName = safeDecodeFileName(direct.url.split("/").pop() || "current-page.pdf");
    return {
      url: direct.url,
      fileName
    };
  }
  const probe = await probePageForPdf(tab.id);
  const inferred = inferPdfSourceFromProbe(probe);
  if (!inferred) {
    throw new Error("\u5F53\u524D\u9875\u9762\u4E0D\u662F\u53EF\u76F4\u63A5\u8BFB\u53D6\u7684 PDF \u6587\u6863");
  }
  return {
    url: inferred.url,
    fileName: safeDecodeFileName(inferred.url.split("/").pop() || "current-page.pdf")
  };
}
function safeDecodeFileName(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "openResultPage") {
    chrome.tabs.create({
      url: chrome.runtime.getURL(`result.html?jobId=${encodeURIComponent(message.jobId)}`)
    }).then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (message?.type === "openOptionsPage") {
    chrome.runtime.openOptionsPage().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "readCurrentTabPdf") {
    resolveCurrentTabPdf().then(async ({ url, fileName }) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`\u8BFB\u53D6\u5F53\u524D PDF \u5931\u8D25: ${response.status}`);
      }
      const bytes = await response.arrayBuffer();
      sendResponse({
        ok: true,
        payload: {
          fileName,
          mimeType: "application/pdf",
          bytes: Array.from(new Uint8Array(bytes))
        }
      });
    }).catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  return false;
});
//# sourceMappingURL=background.js.map
