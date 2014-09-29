/// <reference path="typings/chrome/chrome.d.ts" />

module CamlJs {
    export class ChromeIntegration {

        public static init(listener) {
            if (window["chrome"] && chrome.tabs) {

                chrome.runtime.onConnect.addListener(function (port) {
                    port.onMessage.addListener(listener);
                });

                chrome.tabs.executeScript({
                    file: 'Scripts/livePreview.js'
                });

            }
        }

        public static executeInContentScriptContext(code) {

            if (!window["chrome"] || !chrome.tabs)
                return false;

            chrome.tabs.executeScript({
                code: code
            });

            return true;

        }

    }
}