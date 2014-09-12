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

    function compileCAML(cm) {
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