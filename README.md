CamlJs-Console
==============

Google chrome browser extension that provides a console for creating CamlJS queries right from browser, with live data preview.

Using
-----

Navigate to your portal (any page), open the console, and start creating CamlJs queries.

![caml is generated based on camljs code](https://raw.github.com/andrei-markeev/camljs-console/master/Images/full-view.png)

Intellisense:

![autocomplete and intellisense is available](https://raw.github.com/andrei-markeev/camljs-console/master/Images/intellisense.png)

After query is ready, select a list to test upon, and you'll get the live data preview:

![live preview shows data from your SharePoint lists](https://raw.github.com/andrei-markeev/camljs-console/master/Images/live-data-preview.png)

Some more usage notes
---------------------

At the moment, you cannot directly interact with the underlying SharePoint portal via the CamlJs code editor window, but otherwise, any valid JS code will be processed. E.g. you can use arrays, functions and so on:

![dynamic queries](https://raw.github.com/andrei-markeev/camljs-console/master/Images/dynamic-queries.png)


Intellisense is enhanced with fields of the list, that you're querying against.

![fields intellisense](https://raw.github.com/andrei-markeev/camljs-console/master/Images/intellisense-fields.png)


Installing manually
-------------------

Extension can be installed to Chrome in "unpacked" mode by following the steps below:

 1. Download the source code
 2. Check the "Developer mode" checkbox on the extensions page
 3. Click [Load unpacked extension...] button
 4. Select folder with camljs-console source code
