/// <reference path="typescriptServices.js" />
(function () {
    var editorCM = CodeMirror.fromTextArea(document.getElementById("editor"), {
        lineNumbers: true,
        matchBrackets: true,
        mode: "text/typescript"
    });
    editorCM.setSize(null, "100%");
    var camlCM = CodeMirror.fromTextArea(document.getElementById("caml"), {
        readOnly: true,
        mode: "text/xml"
    });
    camlCM.setSize(null, "100%");

    var tsFactory = new TypeScript.Services.TypeScriptServicesFactory();
    var tsVersion = 1;
    var tsHost = {
        log: function (message) { console.log("tsHost: " + message); },
        information: function (message) { console.log("tsHost: " + message); },
        getCompilationSettings: function () { return "{ \"noLib\": true }"; },
        getScriptFileNames: function () { return "[\"camljs-console.ts\"]" },
        getScriptSnapshot: function (fn) {
            var snapshot = TypeScript.ScriptSnapshot.fromString(camljs_d_ts_contents + editorCM.getValue());
            return {
                getText: function (s, e) { return snapshot.getText(s, e); },
                getLength: function () { return snapshot.getLength(); },
                getLineStartPositions: function () { return "[" + snapshot.getLineStartPositions().toString() + "]" },
                getTextChangeRangeSinceVersion: function (version) {
                    return JSON.stringify({
                        span: { start: camljs_d_ts_length, length: snapshot.getLength() - camljs_d_ts_length },
                        newLength: snapshot.getLength()
                    });
                }
            };
        },
        getScriptVersion: function (fn) { return tsVersion; },
        scriptChanged: function () { tsVersion++; },
        getScriptIsOpen: function (fn) { return true; },
        getLocalizedDiagnosticMessages: function () { return ""; },
        getCancellationToken: function () { return null; },
        getScriptByteOrderMark: function () { return ""; },
    };

    var camljs_d_ts_contents = "";
    var camljs_d_ts_length = 0;
    var tsServiceShim = null;
    var client = new XMLHttpRequest();
    client.open('GET', 'Scripts/typings/camljs/camljs.d.ts');
    client.onreadystatechange = function () {
        if (client.readyState != 4)
            return;
        camljs_d_ts_contents = client.responseText;
        camljs_d_ts_length = camljs_d_ts_contents.length;
        tsServiceShim = tsFactory.createLanguageServiceShim(tsHost);
    }
    client.send();

    var loadingData = false;
    setBadge(0);
    var select = document.getElementById("select-list");
    select.style.display = 'none';
    select.onchange = function () { compileCAML(editorCM); };

    editorCM.on("change", compileCAML);
    compileCAML(editorCM);

    if (window.chrome && chrome.tabs) {

        chrome.runtime.onConnect.addListener(function (port) {
            port.onMessage.addListener(function (msg) {
                if (msg.type == "lists") {
                    for (var i = 0; i < msg.lists.length; i++) {
                        var option = document.createElement("option");
                        option.value = msg.lists[i].id["_m_guidString$p$0"];
                        option.innerHTML = msg.lists[i].title;
                        select.appendChild(option);
                    }
                    select.style.display = '';
                    if (!loadingData)
                        document.getElementById("loading").style.display = 'none';
                }
                else if (msg.type == "items") {
                    setBadge(msg.items.length);
                    var html = "<span class='total'>Rows returned: " + msg.items.length + "</span><ul class='items-preview'>";
                    for (var i = 0; i < msg.items.length; i++) {
                        html += "<li>" + msg.items[i].Title + "</li>";
                    }
                    html += "</ul>";

                    document.getElementById("live-preview").innerHTML = html;
                    document.getElementById("loading").style.display = 'none';
                }
                else if (msg.type == "error")
                {
                    document.getElementById("live-preview").innerHTML = msg.error;
                }
            });
        });

        chrome.tabs.executeScript({
            file:'Scripts/livePreview.js'
        });

    }

    function setBadge(n) {
        var badge = document.getElementById("badge");
        if (n == 0)
            badge.style.display = 'none';
        else {
            badge.style.display = '';
            badge.innerHTML = n;
        }
    }

    function compileCAML(cm, changeObj) {
        if (changeObj && changeObj.text.length == 1 && changeObj.text[0] == '.')
        {
            tsHost.scriptChanged();

            var completions = tsServiceShim.languageService.getCompletionsAtPosition('camljs-console.ts', camljs_d_ts_length + cm.indexFromPos(changeObj.to) + 1, true);

            var list = [];
            for (var i=0;i<completions.entries.length;i++)
                list.push(completions.entries[i].name);

            cm.showHint({ completeSingle: false, hint: function (cm) { return { from: cm.getCursor(), to: cm.getCursor(), list: list }; } });
            return;
        }
        try {
            eval(cm.getValue());
            camlCM.setValue(vkbeautify.xml(query));

            var listId = select.options[select.selectedIndex].value;
            if (window.chrome && chrome.tabs && listId != "") {
                loadingData = true;
                document.getElementById("loading").style.display = '';
                chrome.tabs.executeScript({
                    code: "RequestCamlJsLivePreviewData('" + listId + "', '<View><Query>" + query + "</Query></View>');"
                });
            }
        }
        catch (err) {
            console.log("evaluation error");
            camlCM.setValue("");
            document.getElementById("live-preview").innerHTML = '';
            loadingData = false;
        }
    }

})();