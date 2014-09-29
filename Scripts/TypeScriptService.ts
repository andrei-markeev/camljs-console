module CamlJs {

    class TypeScriptServiceHost implements TypeScript.Services.ILanguageServiceShimHost {
        private tsVersion: number = 0;
        private libText: string = "";
        private libTextLength: number = 0;
        private text: string = "";

        constructor(libText: string) {
            this.libText = libText;
            this.libTextLength = libText.length;
        }

        log(message) { console.log("tsHost: " + message); }
        information() { return true; }
        debug() { return true; }
        warning() { return true; }
        error() { return true; }
        fatal() { return true; }
        getCompilationSettings() { return "{ \"noLib\": true }"; }
        getScriptFileNames() { return "[\"camljs-console.ts\"]" }
        getScriptVersion(fn) { return this.tsVersion; }
        getScriptIsOpen(fn) { return true; }
        getLocalizedDiagnosticMessages() { return ""; }
        getCancellationToken() { return null; }
        getScriptByteOrderMark(fn) { return 0; }
        getLibLength() { return this.libTextLength; }

        resolveRelativePath() { return null; }
        fileExists(fn) { return null; }
        directoryExists(dir) { return null; }
        getParentDirectory(dir) { return null; }
        getDiagnosticsObject() { return null; }

        getScriptSnapshot(fn) {
            var snapshot = TypeScript.ScriptSnapshot.fromString(this.libText + this.text);
            return {
                getText: function (s, e) { return snapshot.getText(s, e); },
                getLength: function () { return snapshot.getLength(); },
                getLineStartPositions: function () { return "[" + snapshot.getLineStartPositions().toString() + "]" },
                getTextChangeRangeSinceVersion: function (version) { return null; }
            };
        }


        public scriptChanged(newText) { this.tsVersion++; this.text = newText; }
    }

    export class TypeScriptService {
        private tsServiceShim: TypeScript.Services.ILanguageServiceShim;
        private tsHost: TypeScriptServiceHost;

        constructor() {

            var self = this;
            var client = new XMLHttpRequest();
            client.open('GET', 'Scripts/typings/camljs/camljs.d.ts');
            client.onreadystatechange = function () {
                if (client.readyState != 4)
                    return;

                self.tsHost = new TypeScriptServiceHost(client.responseText);
                var tsFactory = new TypeScript.Services.TypeScriptServicesFactory();
                self.tsServiceShim = tsFactory.createLanguageServiceShim(self.tsHost);
            }
            client.send();
        }

        public scriptChanged(newText) {
            this.tsHost.scriptChanged(newText);
        }

        public getCompletions(position) {
            return this.tsServiceShim.languageService.getCompletionsAtPosition('camljs-console.ts', position + this.tsHost.getLibLength(), true);
        }

        public getCompletionDetails(position, name) {
            return this.tsServiceShim.languageService.getCompletionEntryDetails('camljs-console.ts', position + this.tsHost.getLibLength(), name);
        }

        public getSignature(position) {
            return this.tsServiceShim.languageService.getSignatureAtPosition('camljs-console.ts', position + this.tsHost.getLibLength());
        }
    }

}