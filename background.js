// background.js
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "openHome",
      title: "InsightBuddyを開く",
      contexts: ["action"]
    });
  });
  
  // アイコンの右クリックイベントを処理
  chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: chrome.runtime.getURL("home.html") });
  });
  
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "openHome") {
      chrome.tabs.create({ url: chrome.runtime.getURL("home.html") });
    }
  });