(function (global) {
    'use strict';

    var scrat = {
        options: {
            timeout: 15, // seconds
            alias: {}, // key - name, value - id
            deps: {}, // key - id, value - name/id
            urlPattern: null, // '/path/to/resources/%s'
            comboPattern: null, // '/path/to/combo-service/%s' or function (ids) { return url; }
            combo: false
        },
        modules: {}, // key - id
        loading: {}, // key - id
        cacheUrl: {}
    };

    /**
     * Mix obj to scrat.options
     * @param {object} obj
     */
    scrat.config = function (obj) {
        var options = scrat.options;
        each(obj, function (value, key) {
            var data = options[key],
                t = type(data);
            if (t === 'object') {
                each(value, function (v, k) {
                    data[k] = v;
                });
            } else {
                if (t === 'array') value = data.concat(value);
                options[key] = value;
            }
        });
    };

    /**
     * Define a module with a factory funciton or any types of value
     * @param {string} id
     * @param {*} factory
     */
    scrat.define = function (id, factory) {
        id = parseAlias(id);
        scrat.modules[id] = {
            factory: factory
        };

        var queue = scrat.loading[id];
        if (queue) {
            each(queue, function (callback) {
                callback.call(scrat);
            });
            delete scrat.loading[id];
        }
    };

    /**
     * Require modules asynchronously with a callback
     * @param {string|array} names
     * @param {function} onload
     */
    scrat.async = function (names, onload) {
        if (type(names) === 'string') names = [names];

        var args = [], deps, i = 0;
        if (scrat.options.combo) {
            each(parseDeps(names), processor);
        } else {
            parseDeps(names, processor);
        }

        function processor(ids, ext, deps) {
            if (ext === 'js' || ext === 'css') {
                load(ids, function () {
                    if (++i === deps.length()) {
                        each(names, function (name) {
                            args.push(require(name));
                        });
                        if (type(onload) === 'function') onload.apply(scrat, args);
                    }
                });
            } else {
                load(ids);
            }
        }
    };

    /**
     * Require another module in factory
     * @param {string} name
     * @returns {*} exports
     */
    function require(name) {
        var id = parseAlias(name),
            module = scrat.modules[id];

        if (parseType(id) !== 'js') return;
        if (!module) throw new Error('failed to require "' + name + '"');

        if (!module.exports) {
            if (type(module.factory) === 'function') {
                module.factory.call(scrat, require, module.exports = {}, module);
            } else {
                module.exports = module.factory;
            }
            delete module.factory;
        }

        return module.exports;
    }
    require.config = scrat.config;
    require.async = scrat.async;

    function type(obj) {
        var t;
        if (obj == null) {
            t = String(obj);
        } else {
            t = Object.prototype.toString.call(obj).toLowerCase();
            t = t.substring(8, t.length - 1);
        }
        return t;
    }

    function each(obj, iterator, context) {
        if (typeof obj !== 'object') return;

        var i, l, t = type(obj);
        context = context || obj;
        if (t === 'array' || t === 'arguments' || t === 'nodelist') {
            for (i = 0, l = obj.length; i < l; i++) {
                if (iterator.call(context, obj[i], i, obj) === false) return;
            }
        } else {
            for (i in obj) {
                if (obj.hasOwnProperty(i)) {
                    if (iterator.call(context, obj[i], i, obj) === false) return;
                }
            }
        }
    }

    function create(proto) {
        function Dummy() {}
        Dummy.prototype = proto;
        return new Dummy();
    }

    /**
     * Parse alias from specified name recursively
     * @param {string} name
     * @returns {string} name
     */
    function parseAlias(name) {
        var alias = scrat.options.alias;
        while (alias[name] && name !== alias[name]) {
            switch (type(alias[name])) {
            case 'function':
                name = alias[name](name);
                break;
            case 'string':
                name = alias[name];
                break;
            }
        }
        return name;
    }

    /**
     * Generate url/combo-url from ids
     * @param {string|array} ids
     * @returns {string} url
     */
    function parseUrl(ids) {
        if (type(ids) === 'string') ids = [ids];
        each(ids, function (id, i) {
            ids[i] = parseAlias(id);
        });

        var options = scrat.options,
            url = options.combo && options.comboPattern || options.urlPattern;
        switch (type(url)) {
        case 'string':
            url = url.replace('%s', ids.join(','));
            break;
        case 'function':
            url = url(ids);
            break;
        default:
            url = ids.join(',');
        }
        return url;
    }

    /**
     * Calculate dependence of a list of ids recursively
     * @param {string|array} ids
     * @param {function} [processor]
     * @private {object} [depends] - used in recursion
     * @returns {object} depends
     */
    function parseDeps(ids, processor, depends) {
        if (type(ids) === 'string') ids = [ids];

        depends = depends || (function (length, proto, depended) {
            proto.length = function () { return length; };
            proto.has = function (id) { return !!depended[id]; };
            proto.add = function (id) {
                var ext = parseType(id);
                this[ext] = this[ext] || [];
                this[ext].unshift(id);
                depended[id] = 1;
                if (ext === 'js') ++length;
                else if (ext === 'css') {
                    if (scrat.options.combo) {
                        // treat multi-css as one
                        if (this[ext].length === 0) ++length;
                    } else {
                        ++length;
                    }
                }
            };
            return create(proto);
        })(0, {}, {});

        var deps = scrat.options.deps;
        each(ids, function (id, i) {
            id = ids[i] = parseAlias(id);
            if (depends.has(id)) return;
            depends.add(id);
            if (deps[id]) parseDeps(deps[id], processor, depends);
            if (type(processor) === 'function') processor(id, parseType(id), depends);
        });
        return depends;
    }

    var TYPE_RE = /(?:\.)(\w+)(?:[?&,]|$)/g;
    function parseType(str) {
        var ext = 'js', match = str.match(TYPE_RE);
        if (str.match(TYPE_RE).length) ext = RegExp.$1;
        if (ext === 'json') ext = 'js';
        else if (ext !== 'js' && ext !== 'css') ext = 'other';
        return ext;
    }

    /**
     * Load a group of resources
     * @param {string|array|object} ids
     * @param {function} [onload]
     */
    function load(ids, onload) {
        if (type(ids) === 'object') {
            each(ids, function (arr) {
                load(arr, onload);
            });
            return;
        } else if (type(ids) === 'string') {
            ids = [ids];
        }

        switch (parseType(ids[0])) {
        case 'js':
            var loading = scrat.loading;
            each(ids, function (id, i) {
                id = ids[i] = parseAlias(id);
                if (scrat.modules[id]) return onload.call(scrat);
                var queue = loading[id] || (loading[id] = []);
                if (type(onload) === 'function') queue.push(onload);
            });
            loadResource(parseUrl(ids));
            break;
        case 'css':
            loadResource(parseUrl(ids), onload);
            break;
        default:
            each(ids, function (id) {
                loadResource(parseUrl(id), onload);
            });
        }
    }

    /**
     * Load any types of resources from specified url
     * @param {string} url
     * @param {function} [onload]
     */
    function loadResource(url, onload) {
        if (scrat.cacheUrl[url]) {
            if (type(onload) === 'function') onload.call(scrat);
            return;
        }
        scrat.cacheUrl[url] = 1;

        var ext = parseType(url),
            isScript = ext === 'js',
            isCss = ext === 'css',
            head = document.getElementsByTagName('head')[0],
            node = document.createElement(isScript ? 'script' : 'link'),
            tid = setTimeout(onerror, scrat.options.timeout * 1000);

        if (isScript) {
            node.type = 'text/javascript';
            node.async = 'async';
            node.src = url;
        } else {
            if (isCss) {
                node.type = 'text/css';
                node.rel = 'stylesheet';
            } else {
                node.rel = 'prefetch';
            }
            node.href = url;
        }

        node.onload = node.onreadystatechange = function () {
            if (!node.readyState ||
                /loaded|complete/.test(node.readyState)) {
                clearTimeout(tid);
                node.onload = node.onreadystatechange = null;
                if (isScript) {
                    if (head && node.parentNode) head.removeChild(node);
                    if (type(onload) === 'function') onload.call(scrat);
                }
                node = null;
            }
        };

        node.onerror = function onerror() {
            clearTimeout(tid);
            throw new Error('error loading url: ' + url);
        };

        head.insertBefore(node, head.firstChild);

        // trigger onload immediately after nonscript node insertion
        if (!isScript) {
            if (isCss) {
                onCssLoad(node, function () {
                    clearTimeout(tid);
                    if (type(onload) === 'function') onload.call(scrat);
                });
            } else {
                if (type(onload) === 'function') onload.call(scrat);
            }
        }
    }

    var oldWebKit = +navigator.userAgent
        .replace(/.*AppleWebKit\/(\d+)\..*/, '$1') < 536;
    function onCssLoad(node, onload) {
        var sheet = node.sheet,
            loaded = false;
        if (oldWebKit) {
            if (sheet) loaded = true;
        } else if (sheet) {
            try {
                if (sheet.cssRules) loaded = true;
            } catch (e) {
                if (e.name === 'NS_ERROR_DOM_SECURITY_ERR') loaded = true;
            }
        }

        setTimeout(function () {
            if (loaded) {
                onload();
            } else {
                onCssLoad(node, onload);
            }
        }, 20);
    }

    global.require = scrat;
    global.define = scrat.define;
})(window);