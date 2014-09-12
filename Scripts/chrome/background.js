chrome.extension.onRequest.addListener(function (request, sender, callback) {
    var tabId = request.tabId;
    chrome.tabs.executeScript(tabId, { file: "livePreview.js" }, function () {
        chrome.tabs.sendRequest(tabId, {}, function (results) {
            
        });
    });
});
