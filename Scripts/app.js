/// <reference path="typescriptServices.js" />
(function () {

    var editorCM;
    var camlCM;
    var tsServiceShim;
    var tsHost;
    var loadingData;
    var haveViewFields;
    var tooltipLastPos;


    function init() {

        initCamlJsEditor();
        initCamlXmlViewer();

        initTypeScriptService();

        loadingData = false;
        haveViewFields = false;
        setBadge(0);
        var select = document.getElementById("select-list");
        select.style.display = 'none';
        select.onchange = function () { compileCAML(editorCM); };

        if (window.chrome && chrome.tabs)
            initChromeIntegration();

        compileCAML(editorCM);

    }

    function initCamlJsEditor() {

        editorCM = CodeMirror.fromTextArea(document.getElementById("editor"), {
            lineNumbers: true,
            matchBrackets: true,
            mode: "text/typescript"
        });
        editorCM.setSize(null, "100%");
        if (localStorage["editorText"])
            editorCM.setValue(localStorage["editorText"]);
        editorCM.on("change", compileCAML);

        tooltipLastPos = { line: -1, ch: -1 };
        editorCM.on("cursorActivity", function () {
            if (editorCM.getCursor().line != tooltipLastPos.line || editorCM.getCursor().ch < tooltipLastPos.ch) {
                $('.tooltip').remove();
            }
        });

    }

    function initCamlXmlViewer() {

        camlCM = CodeMirror.fromTextArea(document.getElementById("caml"), {
            readOnly: true,
            mode: "text/xml"
        });
        camlCM.setSize(null, "100%");

    }

    function initTypeScriptService() {

        var tsFactory = new TypeScript.Services.TypeScriptServicesFactory();
        var tsVersion = 1;
        var camljs_d_ts_contents = "";
        var camljs_d_ts_length = 0;
        tsHost = {
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
            getLibLength: function () { return camljs_d_ts_length; },
        };

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

    }

    function initChromeIntegration() {

        chrome.runtime.onConnect.addListener(function (port) {
            port.onMessage.addListener(livePreviewMessageListener);
        });

        chrome.tabs.executeScript({
            file: 'Scripts/livePreview.js'
        });
    }

    function updateLivePreview(query) {

        var select = document.getElementById("select-list");
        var listId = select.options[select.selectedIndex].value;
        if (window.chrome && chrome.tabs && listId != "") {

            localStorage["selectedListId"] = listId;
            loadingData = true;
            document.getElementById("loading").style.display = '';
            if (query.indexOf('<View>') != 0 && query.indexOf('<View ') != 0) {
                var viewFieldsString = "";
                if (window.g_viewFieldsForList && window.g_viewFieldsForList[listId]) {
                    viewFieldsString += "<ViewFields>";
                    for (var j = 0; j < window.g_viewFieldsForList[listId].length; j++)
                        viewFieldsString += '<FieldRef Name="' + window.g_viewFieldsForList[listId][j] + '" />';
                    viewFieldsString += "</ViewFields>";
                }
                query = "<View>" + viewFieldsString + "<Query>" + query + "</Query></View>";
            }
            else {
                // TODO: queries with ViewFields should display appropriate columns
            }
            chrome.tabs.executeScript({
                code: "RequestCamlJsLivePreviewData('" + listId + "', '" + query + "');"
            });
        }

    }

    function livePreviewMessageListener(msg)
    {
        if (msg.type == "lists") {
            setupListsDropdown(msg.lists);
        }
        else if (msg.type == "fieldsInfo") {
            rememberFieldsInfo(msg.fieldsInfo);

            if (localStorage["selectedListId"])
                compileCAML(editorCM);
        }
        else if (msg.type == "items") {
            setBadge(msg.items.length);
            haveViewFields = window.g_viewFieldsForList && window.g_viewFieldsForList[localStorage["selectedListId"]];

            document.getElementById("live-preview").innerHTML = generateItemsHtml(msg.items);
            document.getElementById("loading").style.display = 'none';
        }
        else if (msg.type == "error") {
            document.getElementById("live-preview").innerHTML = msg.error;
            document.getElementById("loading").style.display = 'none';
        }
    }


    function setupListsDropdown(lists)
    {
        var select = document.getElementById("select-list");
        while (select.childNodes.length > 1) {
            select.removeChild(select.childNodes[1]);
        }
        for (var i = 0; i < lists.length; i++) {
            var option = document.createElement("option");
            option.value = lists[i].id;
            option.innerHTML = lists[i].title;
            select.appendChild(option);

            if (option.value == localStorage["selectedListId"])
                option.selected = true;
        }
        select.style.display = '';
        if (!loadingData)
            document.getElementById("loading").style.display = 'none';

    }

    function rememberFieldsInfo(fieldsInfo) {
        window.g_viewFieldsForList = window.g_viewFieldsForList || {};
        window.g_listFieldsByType = window.g_listFieldsByType || {};
        for (var i = 0; i < fieldsInfo.length; i++) {
            var viewFields = fieldsInfo[i].viewFields;

            var docIconIndex = viewFields.indexOf("DocIcon");
            if (docIconIndex > -1)
                viewFields.splice(docIconIndex, 1);

            for (var j = 0; j < viewFields.length; j++) {
                if (viewFields[j] == "LinkTitle" || viewFields[j] == "LinkTitleNoMenu" || viewFields[j] == "LinkDiscussionTitle")
                    viewFields[j] = "Title";
                if (viewFields[j] == "LinkFilename" || viewFields[j] == "LinkFilenameNoMenu")
                    viewFields[j] = "FileLeafRef";
            }

            window.g_viewFieldsForList[fieldsInfo[i].id] = viewFields;

            var fieldsByOriginalType = fieldsInfo[i].listFieldsByType;
            var fieldsByType = {};
            for (var type in fieldsByOriginalType) {
                var fType = type;
                if (type == "Guid" || type == "Note" || type == "Computed" || type == "ModStat" || type == "ContentTypeId" || type == "TargetTo" || type == "File")
                    fType = "Text";
                if (type == "TaxonomyFieldType")
                    fType = "Lookup";
                if (type == "TaxonomyFieldTypeMulti")
                    fType = "LookupMulti";
                if (type == "RatingCount" || type == "ThreadIndex" || type == "Likes")
                    fType = "Integer";
                if (type == "AverageRating")
                    fType = "Number";
                if (type == "Attachments")
                    fType = "Boolean";

                if (!fieldsByType[fType])
                    fieldsByType[fType] = [];
                
                for (var k = 0; k < fieldsByOriginalType[type].length; k++)
                    fieldsByType[fType].push(fieldsByOriginalType[type][k]);

            }

            window.g_listFieldsByType[fieldsInfo[i].id] = fieldsByType;
        }
    }

    function generateItemsHtml(items) {
        var html = "<span class='total'>Rows returned: " + items.length + "</span>";
        if (haveViewFields) {
            var viewFields = window.g_viewFieldsForList[localStorage["selectedListId"]];
            html += "<table class='table table-striped'>";
            html += "<thead><tr>";
            for (var j = 0; j < viewFields.length; j++) {
                html += "<th>" + viewFields[j] + "</th>";
            }
            html += "</tr></thead>";
            html += "<tbody>";
            for (var i = 0; i < items.length; i++) {
                html += "<tr>";
                for (var j = 0; j < viewFields.length; j++) {
                    html += "<td>" + items[i][viewFields[j]] + "</td>";
                }
                html += "</tr>";
            }
            html += "</tbody></table>";
        }
        else {
            html += "<ul class='items-preview'>";
            for (var i = 0; i < items.length; i++) {
                html += "<li>" + items[i].Title + "</li>";
            }
            html += "</ul>";
        }
        return html;

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

    function showAutoCompleteDropDown(cm, changePosition)
    {
        var scriptPosition = tsHost.getLibLength() + cm.indexFromPos(changePosition) + 1;
        var completions = tsServiceShim.languageService.getCompletionsAtPosition('camljs-console.ts', scriptPosition, true);

        if (completions == null)
            return;

        $('.tooltip').remove();

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
            if (fieldType == "Url")
                fieldType = "URL";
            var listId = localStorage["selectedListId"];
            if (listId && window.g_listFieldsByType && g_listFieldsByType[listId] && g_listFieldsByType[listId][fieldType]) {
                var availableFields = g_listFieldsByType[listId][fieldType];
                for (var f_i = 0; f_i < availableFields.length; f_i++) {
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

        list.sort(function (l, r) {
            if (l.displayText > r.displayText) return 1;
            if (l.displayText < r.displayText) return -1;
            return 0;
        });

        cm.showHint({
            completeSingle: false,
            hint: function (cm) {
                var cur = cm.getCursor();
                var token = cm.getTokenAt(cur);
                var completionInfo = null;
                var show_words = [];
                if (token.string == ".") {
                    for (var i = 0; i < list.length; i++) {
                        if (list[i].livePreview == false)
                            show_words.push(list[i]);
                    }

                    completionInfo = { from: cur, to: cur, list: show_words };
                }
                else {
                    for (var i = 0; i < list.length; i++) {
                        if (list[i].text.toLowerCase().indexOf(token.string.toLowerCase()) > -1)
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
                        title: '<div class="tooltip-typeInfo">' + completion.typeInfo + '</div>' + '<div class="tooltip-docComment">' + completion.docComment.replace('\n', '<br/>') + '</div>',
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

    }

    function showFunctionTooltip(cm, changePosition) {

        $('.tooltip').remove();

        var scriptPosition = tsHost.getLibLength() + cm.indexFromPos(changePosition) + 1;
        var signature = tsServiceShim.languageService.getSignatureAtPosition("camljs-console.ts", scriptPosition);

        if (signature) {
            tooltipLastPos = changePosition;
            var cursorCoords = cm.cursorCoords();
            var domElement = cm.getWrapperElement();

            $(domElement).data('bs.tooltip', false).tooltip({
                html: true,
                title: '<div class="tooltip-typeInfo">' + signature.formal[0].signatureInfo + '</div>' + '<div class="tooltip-docComment">' + signature.formal[0].docComment.replace('\n', '<br/>') + '</div>',
                trigger: 'manual', container: 'body', placement: 'bottom'
            });
            $(domElement).off('shown.bs.tooltip').on('shown.bs.tooltip', function () {
                $('.tooltip').css('top', cursorCoords.bottom + "px").css('left', cursorCoords.left + "px")
            });
            $(domElement).tooltip('show');
        }
    }

    function compileCAML(cm, changeObj) {

        localStorage["editorText"] = cm.getValue();

        if (changeObj && changeObj.text.length == 1 && (changeObj.text[0] == '.' || changeObj.text[0] == ' '))
        {
            tsHost.scriptChanged();
            showAutoCompleteDropDown(cm, changeObj.to);
            return;
        }
        else if (changeObj && changeObj.text.length == 1 && (changeObj.text[0] == '(' || changeObj.text[0] == ','))
        {
            tsHost.scriptChanged();
            showFunctionTooltip(cm, changeObj.to);
            return;
        }
        else if (changeObj && changeObj.text.length == 1 && changeObj.text[0] == ')')
        {
            $('.tooltip').remove();
        }

        try {
            eval(cm.getValue());
            camlCM.setValue(vkbeautify.xml(query));
            updateLivePreview(query);
        }
        catch (err) {
            console.log("evaluation error");
            camlCM.setValue("");
            document.getElementById("live-preview").innerHTML = '';
            loadingData = false;
        }
    }


    init();

})();