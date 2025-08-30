// Erstelle neue Datei: assets/js/module-loader.js
class ModuleLoader {
    constructor() {
        this.modules = {
            utils: false,
            admin: false,
            'tinymce-editor': false,
            'ai-assistant': false,
            comments: false
        };
        
        this.callbacks = [];
        this.initialized = false;
    }
    
    markLoaded(moduleName) {
        if (this.modules.hasOwnProperty(moduleName)) {
            this.modules[moduleName] = true;
            //console.log(`Modul ${moduleName} geladen`);
            
            if (this.allModulesLoaded()) {
                this.executeCallbacks();
            }
        }
    }
    
    allModulesLoaded() {
        return Object.values(this.modules).every(loaded => loaded);
    }
    
    onAllLoaded(callback) {
        if (this.initialized) {
            callback();
        } else {
            this.callbacks.push(callback);
        }
    }
    
    executeCallbacks() {
        if (this.initialized) return;
        
        //console.log('Alle Module geladen - führe Callbacks aus...');
        this.initialized = true;
        
        this.callbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Fehler beim Ausführen des Callbacks:', error);
            }
        });
    }
    
    // Auto-detect verfügbare Module
    detectModules() {
        this.markLoaded('utils');
        this.markLoaded('admin');
        this.markLoaded('tinymce-editor');
        this.markLoaded('ai-assistant');
        this.markLoaded('comments');
        // ... weitere Module ...
    }
}

// Globaler Module Loader
window.moduleLoader = new ModuleLoader();

// Auto-Start bei DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    window.moduleLoader.detectModules();
});