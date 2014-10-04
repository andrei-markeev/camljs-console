/// <reference path="typings/jquery/jquery.d.ts" />
/// <reference path="typings/bootstrap/bootstrap.d.ts" />

var vkbeautify: any;

module CamlJs {
    export class Console {
        private editorCM: CodeMirror.Editor;
        private camlCM: CodeMirror.Editor;
        private typeScriptService: CamlJs.TypeScriptService;
        private loadingData = false;
        private haveViewFields = false;
        private tooltipLastPos = { line: -1, ch: -1 };

        private queryViewFields: { [listId: string]: string[] } = {};
        private viewFieldsForList: { [listId: string]: string[] } = {};
        private listFieldsByType: { [listId: string]: { [fieldType: string]: string[] } } = {};
        private static instance: CamlJs.Console;
        
        public static start() {

            Console.instance = new Console();
            Console.instance.initialize();
        }

        private initialize() {
            Console.instance.typeScriptService = new CamlJs.TypeScriptService();
            Console.instance.editorCM = Console.instance.initCamlJsEditor();
            Console.instance.initCamlXmlViewer();
            Console.instance.initListSelect();

            Console.instance.loadingData = false;
            Console.instance.haveViewFields = false;
            Console.instance.setBadge(0);

            CamlJs.ChromeIntegration.init(Console.instance.livePreviewMessageListener);

            Console.instance.compileCAML(Console.instance.editorCM.getDoc());
        }

        private initCamlJsEditor() {

            var editor = CodeMirror.fromTextArea(<HTMLTextAreaElement>document.getElementById("editor"), {
                lineNumbers: true,
                matchBrackets: true,
                mode: "text/typescript"
            });
            editor.setSize(null, "100%");
            if (localStorage["editorText"])
                editor.getDoc().setValue(localStorage["editorText"]);

            editor.on("cursorActivity", function (cm) {
                if (cm.getDoc().getCursor().line != Console.instance.tooltipLastPos.line || cm.getDoc().getCursor().ch < Console.instance.tooltipLastPos.ch) {
                    $('.tooltip').remove();
                }
            });

            editor.on("change", function (editor, changeList) { Console.instance.compileCAML(editor.getDoc(), changeList) });
            return editor;
        }

        private initCamlXmlViewer() {

            Console.instance.camlCM = CodeMirror.fromTextArea(<HTMLTextAreaElement>document.getElementById("caml"), {
                readOnly: true,
                mode: "text/xml"
            });
            Console.instance.camlCM.setSize(null, "100%");

        }

        private initListSelect() {
            var self = this;
            var select = document.getElementById("select-list");
            select.style.display = 'none';
            select.onchange = function () {
                Console.instance.compileCAML(Console.instance.editorCM.getDoc());
            };
        }


        private updateLivePreview(query) {

            var select = <HTMLSelectElement>document.getElementById("select-list");
            var listId: string = select.options[select.selectedIndex].value;
            if (listId != "") {

                localStorage["selectedListId"] = listId;
                Console.instance.loadingData = true;
                document.getElementById("loading").style.display = '';
                if (query.indexOf('<View>') != 0 && query.indexOf('<View ') != 0) {
                    var viewFieldsString = "";
                    if (Console.instance.viewFieldsForList[listId]) {
                        viewFieldsString += "<ViewFields>";
                        for (var j = 0; j < Console.instance.viewFieldsForList[listId].length; j++)
                            viewFieldsString += '<FieldRef Name="' + Console.instance.viewFieldsForList[listId][j] + '" />';
                        viewFieldsString += "</ViewFields>";
                    }
                    query = "<View>" + viewFieldsString + "<Query>" + query + "</Query></View>";
                    Console.instance.queryViewFields[listId] = null;
                }
                else {

                    Console.instance.queryViewFields[listId] = [];
                    var viewFields = $(query).find("viewfields fieldref");
                    for (var j = 0; j < viewFields.length; j++) {
                        Console.instance.queryViewFields[listId].push(viewFields[j].attributes["name"].value);
                    }
                }
                var success = CamlJs.ChromeIntegration.executeInContentScriptContext("RequestCamlJsLivePreviewData('" + listId + "', '" + query + "');");
                if (!success) {
                    Console.instance.loadingData = false;
                    document.getElementById("loading").style.display = 'none';
                }
            }

        }

        private livePreviewMessageListener(msg) {
            if (msg.type == "lists") {
                Console.instance.setupListsDropdown(msg.lists);
            }
            else if (msg.type == "fieldsInfo") {
                Console.instance.rememberFieldsInfo(msg.fieldsInfo);

                if (localStorage["selectedListId"])
                    Console.instance.compileCAML(Console.instance.editorCM.getDoc());
            }
            else if (msg.type == "items") {
                Console.instance.setBadge(msg.items.length);
                Console.instance.haveViewFields = Console.instance.viewFieldsForList[localStorage["selectedListId"]] != null;

                document.getElementById("live-preview").innerHTML = Console.instance.generateItemsHtml(msg.items);
                document.getElementById("loading").style.display = 'none';
            }
            else if (msg.type == "error") {
                document.getElementById("live-preview").innerHTML = msg.error;
                document.getElementById("loading").style.display = 'none';
                Console.instance.setBadge(0);
            }
        }


        private setupListsDropdown(lists) {
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
            if (!Console.instance.loadingData)
                document.getElementById("loading").style.display = 'none';

        }

        private rememberFieldsInfo(fieldsInfo) {
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

                Console.instance.viewFieldsForList[fieldsInfo[i].id] = viewFields;

                var fieldsByOriginalType = fieldsInfo[i].listFieldsByType;
                var fieldsByType: { [type: string]: string[] } = {};
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

                Console.instance.listFieldsByType[fieldsInfo[i].id] = fieldsByType;
            }
        }

        private generateItemsHtml(items) {
            var html = "<span class='total'>Rows returned: " + items.length + "</span>";
            if (Console.instance.haveViewFields) {
                var viewFields = Console.instance.queryViewFields[localStorage["selectedListId"]];
                if (!viewFields || viewFields.length == 0)
                    viewFields = Console.instance.viewFieldsForList[localStorage["selectedListId"]];
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

        private setBadge(n) {
            var badge = document.getElementById("badge");
            if (n == 0)
                badge.style.display = 'none';
            else {
                badge.style.display = '';
                badge.innerHTML = n;
            }
        }

        private showCodeMirrorHint(cm: CodeMirror.Doc, list) {
            list.sort(function (l, r) {
                if (l.displayText > r.displayText) return 1;
                if (l.displayText < r.displayText) return -1;
                return 0;
            });

            cm.getEditor()["showHint"]({
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
                    else if (token.string == "," || token.string == "(") {

                        completionInfo = { from: cur, to: cur, list: list };

                    }
                    else {
                        for (var i = 0; i < list.length; i++) {
                            if (list[i].text.toLowerCase().indexOf(token.string.toLowerCase()) > -1)
                                show_words.push(list[i]);
                        }

                        completionInfo = {
                            from: { line: cur.line, ch: token.start },
                            to: { line: cur.line, ch: token.end },
                            list: show_words
                        };
                    }

                    var tooltip;
                    CodeMirror.on(completionInfo, "select", function (completion, element) {
                        $('.tooltip').remove();
                        if (completion.typeInfo) {
                            $(element).tooltip({
                                html: true,
                                title: '<div class="tooltip-typeInfo">' + completion.typeInfo + '</div>' + '<div class="tooltip-docComment">' + completion.docComment.replace('\n', '<br/>') + '</div>',
                                trigger: 'manual', container: 'body', placement: 'right'
                            });
                            $(element).tooltip('show');
                        }
                    });
                    CodeMirror.on(completionInfo, "close", function () {
                        $('.tooltip').remove();
                    });

                    return completionInfo;
                }
            });
        }

        private showAutoCompleteDropDown(cm: CodeMirror.Doc, changePosition) {
            var scriptPosition = cm.indexFromPos(changePosition) + 1;
            var completions = Console.instance.typeScriptService.getCompletions(scriptPosition);

            if (completions == null)
                return;

            $('.tooltip').remove();

            var list = [];
            for (var i = 0; i < completions.entries.length; i++) {
                var details = Console.instance.typeScriptService.getCompletionDetails(scriptPosition, completions.entries[i].name);
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
                if (listId && Console.instance.listFieldsByType[listId] && Console.instance.listFieldsByType[listId][fieldType]) {
                    var availableFields = Console.instance.listFieldsByType[listId][fieldType];
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

            Console.instance.showCodeMirrorHint(cm, list);

        }

        private showFunctionTooltip(cm: CodeMirror.Doc, changePosition) {

            $('.tooltip').remove();

            var signature = Console.instance.typeScriptService.getSignature(cm.indexFromPos(changePosition) + 1);

            if (signature) {

                if (signature.actual.currentParameter != -1
                    && !signature.actual.currentParameterIsTypeParameter
                    &&
                    (signature.formal[signature.activeFormal].parameters[signature.actual.currentParameter].name == "viewFields"
                    || signature.formal[signature.activeFormal].parameters[signature.actual.currentParameter].name == "fieldInternalName")) {
                    var listId = localStorage["selectedListId"];
                    var list = [];
                    for (var t in Console.instance.listFieldsByType[listId]) {
                        for (var i = 0; i < Console.instance.listFieldsByType[listId][t].length; i++) {
                            list.push({
                                text: "\"" + Console.instance.listFieldsByType[listId][t][i] + "\"",
                                displayText: Console.instance.listFieldsByType[listId][t][i],
                                className: "autocomplete-livePreview",
                                livePreview: true
                            });
                        }
                    }
                    Console.instance.showCodeMirrorHint(cm, list);
                    return;
                }

                Console.instance.tooltipLastPos = changePosition;
                var cursorCoords = cm.getEditor().cursorCoords(cm.getCursor(), "page");
                var domElement = cm.getEditor().getWrapperElement();

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

        private compileCAML(cm: CodeMirror.Doc, changeObj?: CodeMirror.EditorChangeLinkedList) {

            localStorage["editorText"] = cm.getValue();

            if (changeObj)
                Console.instance.typeScriptService.scriptChanged(cm.getValue(), cm.indexFromPos(changeObj.from), cm.indexFromPos(changeObj.to) - cm.indexFromPos(changeObj.from));

            if (changeObj && changeObj.text.length == 1 && (changeObj.text[0] == '.' || changeObj.text[0] == ' ')) {
                Console.instance.showAutoCompleteDropDown(cm, changeObj.to);
                return;
            }
            else if (changeObj && changeObj.text.length == 1 && (changeObj.text[0] == '(' || changeObj.text[0] == ',')) {
                Console.instance.showFunctionTooltip(cm, changeObj.to);
            }
            else if (changeObj && changeObj.text.length == 1 && changeObj.text[0] == ')') {
                $('.tooltip').remove();
            }

            var allMarkers = cm.getAllMarks();
            for (var i = 0; i < allMarkers.length; i++)
            {
                allMarkers[i].clear();
            }
            if (changeObj) {
                var errors = Console.instance.typeScriptService.getErrors();
                for (var i = 0; i < errors.length; i++) {
                    cm.markText(cm.posFromIndex(errors[i].start()), cm.posFromIndex(errors[i].start() + errors[i].length()), {
                        className: "syntax-error",
                        title: errors[i].text()
                    });

                }
            }

            var query: string = "";
            try {
                eval(cm.getValue());
            }
            catch (err) {
                console.log("evaluation error");
                Console.instance.camlCM.getDoc().setValue("");
                document.getElementById("live-preview").innerHTML = '';
                Console.instance.loadingData = false;
            }
            if (query != "") {
                Console.instance.camlCM.getDoc().setValue(vkbeautify.xml(query));
                Console.instance.updateLivePreview(query);
            }
        }

    }

}
