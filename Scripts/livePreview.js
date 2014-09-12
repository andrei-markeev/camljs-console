(function () {

    var getLists = function () {
        var ctx = SP.ClientContext.get_current();
        var lists = ctx.get_web().get_lists();
        ctx.load(lists);
        ctx.executeQueryAsync(function () {
            var enumerator = lists.getEnumerator();
            var lists_array = [];
            while (enumerator.moveNext()) {
                var list = enumerator.get_current();
                if (list.get_hidden() == false)
                    lists_array.push({ title: list.get_title(), id: list.get_id() });
            }
            window.postMessage({ id: "CamlJsConsole", type: "lists", lists: lists_array }, "*");
        },
        function (sender, args) {
            window.postMessage({ id: "CamlJsConsole", type: "error", error: args.get_message() }, "*");
        });
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
                items_array.push({ Title: item.get_item("Title") });
            }
            window.postMessage({ id: "CamlJsConsole", type: "items", items: items_array }, "*");
        },
        function (sender, args) {
            window.postMessage({ id: "CamlJsConsole", type: "error", error: args.get_message() }, "*");
        });
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