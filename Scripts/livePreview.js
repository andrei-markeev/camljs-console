(function () {

    var getLists = function () {
        try
        {
            var ctx = SP.ClientContext.get_current();
            var lists = ctx.get_web().get_lists();
            ctx.load(lists, 'Include(Id,Title,Hidden)');
            ctx.executeQueryAsync(function () {
                var enumerator = lists.getEnumerator();
                var lists_array = [];
                var views = [];
                while (enumerator.moveNext()) {
                    var list = enumerator.get_current();
                    if (list.get_hidden() == false) {
                        if (list.get_defaultView) {
                            var defaultView = list.get_defaultView();
                            ctx.load(defaultView, 'ViewFields');
                            views.push({ id: list.get_id().toString(), view: defaultView });
                        }
                        else // SP2010
                        {
                            var all_views = list.get_views();
                            ctx.load(all_views, 'Include(DefaultView, ViewFields)');
                            views.push({ id: list.get_id().toString(), all_views: all_views });
                        }
                        lists_array.push({ title: list.get_title(), id: list.get_id().toString() });
                    }
                }
                window.postMessage({ id: "CamlJsConsole", type: "lists", lists: lists_array }, "*");
                ctx.executeQueryAsync(function () {
                    var views_array = [];
                    for (var i = 0; i < views.length; i++) {
                        if (views[i].all_views)
                        {
                            var viewsEnumerator = views[i].all_views.getEnumerator();
                            while (viewsEnumerator.moveNext())
                            {
                                var v = viewsEnumerator.get_current();
                                if (v.get_defaultView())
                                {
                                    views[i].view = v;
                                    break;
                                }
                            }
                        }
                        if (views[i].view) {
                            var fieldsEnumerator = views[i].view.get_viewFields().getEnumerator();
                            var fields_array = [];
                            while (fieldsEnumerator.moveNext()) {
                                fields_array.push(fieldsEnumerator.get_current());
                            }
                            views_array.push({ id: views[i].id, viewFields: fields_array });
                        }
                    }
                    window.postMessage({ id: "CamlJsConsole", type: "views", views: views_array }, "*");
                }, jsomErrorHandler)
            }, jsomErrorHandler);
        }
        catch(e)
        {
            window.postMessage({ id: "CamlJsConsole", type: "error", error: "Fatal error retrieving lists from portal!<br />Please note: data preview only works with SharePoint 2010 and 2013 and you need to have appropriate permissions.<br />Error message: " + e.message }, "*");
        }

        function jsomErrorHandler(sender, args) {
            window.postMessage({ id: "CamlJsConsole", type: "error", error: "Error when retrieving lists from SharePoint: " + args.get_message() }, "*");
        }
    }

    var getItems = function (listId, queryText) {
        var ctx = SP.ClientContext.get_current();
        var query = new SP.CamlQuery();
        query.set_viewXml(queryText);
        var list = ctx.get_web().get_lists().getById(listId);
        var items = list.getItems(query);
        ctx.load(items);
        ctx.executeQueryAsync(function () {
            var enumerator = items.getEnumerator();
            var items_array = [];
            while (enumerator.moveNext()) {
                var item = enumerator.get_current();
                var values = item.get_fieldValues();
                for (var p in values)
                {
                    values[p] = preprocess(values[p]);
                }
                items_array.push(values);
            }
            window.postMessage({ id: "CamlJsConsole", type: "items", items: items_array }, "*");
        },
        function (sender, args) {
            window.postMessage({ id: "CamlJsConsole", type: "error", error: "Error when retrieving items from SharePoint: " + args.get_message() }, "*");
        });

        function preprocess(value)
        {
            if (value && value instanceof Array) {

                var html = "";
                for (var a = 0; a < value.length; a++)
                    html += preprocess(value[a]);

                return html;

            }
            else {

                if (value && value.get_lookupId)
                    return '<div class="term" title="Lookup Id:' + value.get_lookupId() + '">' + value.get_lookupValue() + '</div>';
                else if (value && value.TermGuid)
                    return '<div class="term">' + value.Label + '</div>';
                else if (value == null)
                    return '';
                else if (value instanceof Date)
                    return value.toLocaleString();
                else if (typeof value == "string" || typeof value == "number" || typeof value == "boolean")
                    return value;
                else if (value instanceof SP.Guid)
                    return value.toString();
                else
                    debugger;
            }
        }

    }



    function injectCodeToPage(code, args) {
        var script = document.createElement('script');
        script.textContent = '(' + code + ')(' + (args || '') + ');';
        (document.head || document.documentElement).appendChild(script);
        script.parentNode.removeChild(script);
    }

    window.addEventListener("message", function (event) {
        if (event.data.id && event.data.id == "CamlJsConsole")
        {
            var port = chrome.runtime.connect({ name: "CamlJsConsole" });
            port.postMessage(event.data);
        }
    });

    injectCodeToPage(getLists);

    window.RequestCamlJsLivePreviewData = function (listId, queryText) {
        injectCodeToPage(getItems, "'" + listId + "','" + queryText + "'");
    }


})();