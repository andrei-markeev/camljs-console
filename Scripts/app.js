/// <reference path="typescriptServices.js" />
(function () {
    var editorCM = CodeMirror.fromTextArea(document.getElementById("editor"), {
        lineNumbers: true,
        matchBrackets: true,
        mode: "text/typescript"
    });
    editorCM.setSize(null, "100%");
    if (localStorage["editorText"])
        editorCM.setValue(localStorage["editorText"]);

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
                getTextChangeRangeSinceVersion: function (version) { return null; }
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
                        option.value = msg.lists[i].id;
                        option.innerHTML = msg.lists[i].title;
                        select.appendChild(option);

                        if (option.value == localStorage["selectedListId"])
                            option.selected = true;
                    }
                    select.style.display = '';
                    if (!loadingData)
                        document.getElementById("loading").style.display = 'none';
                }
                else if (msg.type == "fieldsInfo") {

                    window.g_viewFieldsForList = window.g_viewFieldsForList || {};
                    window.g_listFieldsByType = window.g_listFieldsByType || {};
                    for (var i = 0; i < msg.fieldsInfo.length; i++) {
                        var viewFields = msg.fieldsInfo[i].viewFields;

                        var docIconIndex = viewFields.indexOf("DocIcon");
                        if (docIconIndex > -1)
                            viewFields.splice(docIconIndex, 1);

                        for (var j = 0; j < viewFields.length; j++) {
                            if (viewFields[j] == "LinkTitle" || viewFields[j] == "LinkTitleNoMenu" || viewFields[j] == "LinkDiscussionTitle")
                                viewFields[j] = "Title";
                            if (viewFields[j] == "LinkFilename" || viewFields[j] == "LinkFilenameNoMenu")
                                viewFields[j] = "FileLeafRef";
                        }

                        window.g_viewFieldsForList[msg.fieldsInfo[i].id] = viewFields;
                        window.g_listFieldsByType[msg.fieldsInfo[i].id] = msg.fieldsInfo[i].listFieldsByType;
                    }

                    if (localStorage["selectedListId"])
                        compileCAML(editorCM);
                }
                else if (msg.type == "items") {
                    setBadge(msg.items.length);
                    var haveViewFields = window.g_viewFieldsForList && window.g_viewFieldsForList[localStorage["selectedListId"]];
                    var html = "<span class='total'>Rows returned: " + msg.items.length + "</span>";
                    if (haveViewFields) {
                        var viewFields = window.g_viewFieldsForList[localStorage["selectedListId"]];
                        html += "<table class='table table-striped'>";
                        html += "<thead><tr>";
                        for (var j = 0; j < viewFields.length; j++) {
                            html += "<th>" + viewFields[j] + "</th>";
                        }
                        html += "</tr></thead>";
                        html += "<tbody>";
                        for (var i = 0; i < msg.items.length; i++) {
                            html += "<tr>";
                            for (var j = 0; j < viewFields.length; j++) {
                                html += "<td>" + msg.items[i][viewFields[j]] + "</td>";
                            }
                            html += "</tr>";
                        }
                        html += "</tbody></table>";
                    }
                    else {
                        html += "<ul class='items-preview'>";
                        for (var i = 0; i < msg.items.length; i++) {
                            html += "<li>" + msg.items[i].Title + "</li>";
                        }
                        html += "</ul>";
                    }

                    document.getElementById("live-preview").innerHTML = html;
                    document.getElementById("loading").style.display = 'none';
                }
                else if (msg.type == "error") {
                    document.getElementById("live-preview").innerHTML = msg.error;
                    document.getElementById("loading").style.display = 'none';
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

        localStorage["editorText"] = cm.getValue();

        if (changeObj && changeObj.text.length == 1 && changeObj.text[0] == '.')
        {
            tsHost.scriptChanged();

            var scriptPosition = camljs_d_ts_length + cm.indexFromPos(changeObj.to) + 1;
            var completions = tsServiceShim.languageService.getCompletionsAtPosition('camljs-console.ts', scriptPosition, true);

            var list = [];
            for (var i = 0; i < completions.entries.length; i++) {
                var details = tsServiceShim.languageService.getCompletionEntryDetails('camljs-console.ts', scriptPosition, completions.entries[i].name)
                list.push({
                    text: completions.entries[i].name,
                    displayText: completions.entries[i].name,
                    typeInfo: details.type,
                    kind: completions.entries[i].kind,
                    docComment: details.docComment,
                    className: "autocomplete-" + completions.entries[i].kind,
                    livePreview: false
                });
                var fieldType = completions.entries[i].name.replace('Field', '');
                var listId = localStorage["selectedListId"];
                if (listId && g_listFieldsByType[listId] && g_listFieldsByType[listId][fieldType])
                {
                    var availableFields = g_listFieldsByType[listId][fieldType];
                    for (var f_i = 0; f_i < availableFields.length; f_i++)
                    {
                        list.push({
                            text: completions.entries[i].name + '("' + availableFields[f_i] + '")',
                            displayText: completions.entries[i].name + '("' + availableFields[f_i] + '")',
                            typeInfo: details.type,
                            kind: completions.entries[i].kind,
                            docComment: "Test a condition against the '" + availableFields[f_i] + "' field.",
                            className: "autocomplete-livePreview",
                            livePreview: true
                        });
                    }
                }
            }

            cm.showHint({
                completeSingle: false,
                hint: function (cm) {
                    var cur = cm.getCursor();
                    var token = cm.getTokenAt(cur);
                    var completionInfo = null;
                    var show_words = [];
                    if (token.string == ".")
                    {
                        for (var i = 0; i < list.length; i++) {
                            if (list[i].livePreview == false)
                                show_words.push(list[i]);
                        }

                        completionInfo = { from: cur, to: cur, list: show_words };
                    }
                    else
                    {
                        for (var i = 0; i < list.length; i++)
                        {
                            if (list[i].text.indexOf(token.string) > -1)
                                show_words.push(list[i]);
                        }
                        completionInfo = {
                            from: CodeMirror.Pos(cur.line, token.start),
                            to: CodeMirror.Pos(cur.line, token.end),
                            list: show_words
                        };
                    }

                    var tooltip;
                    CodeMirror.on(completionInfo, "select", function (completion, element) {
                        $('.tooltip').remove();
                        $(element).tooltip({
                            html: true,
                            title: '<div class="tooltip-typeInfo">' + completion.typeInfo + '</div>' + '<div class="tooltip-docComment">' + completion.docComment.replace('\n','<br/>') + '</div>',
                            trigger: 'manual', container: 'body', placement: 'right'
                        });
                        $(element).tooltip('show');
                    });
                    CodeMirror.on(completionInfo, "close", function () {
                        $('.tooltip').remove();
                    });

                    return completionInfo;
                }
            });

            return;
        }
        try {
            eval(cm.getValue());
            camlCM.setValue(vkbeautify.xml(query));

            var listId = select.options[select.selectedIndex].value;
            if (window.chrome && chrome.tabs && listId != "") {
                localStorage["selectedListId"] = listId;
                loadingData = true;
                document.getElementById("loading").style.display = '';
                if (query.indexOf('<View>') != 0 && query.indexOf('<View ') != 0) {
                    var viewFieldsString = "";
                    if (window.g_viewFieldsForList && window.g_viewFieldsForList[listId])
                    {
                        viewFieldsString += "<ViewFields>";
                        for (var j = 0; j < window.g_viewFieldsForList[listId].length; j++)
                            viewFieldsString += '<FieldRef Name="' + window.g_viewFieldsForList[listId][j] + '" />';
                        viewFieldsString += "</ViewFields>";
                    }
                    query = "<View>" + viewFieldsString + "<Query>" + query + "</Query></View>";
                }
                else
                {
                    // TODO: queries with ViewFields should display appropriate columns
                }
                chrome.tabs.executeScript({
                    code: "RequestCamlJsLivePreviewData('" + listId + "', '" + query + "');"
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