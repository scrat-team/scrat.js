(function (global) {
    'use strict';

    var scrat = {
        options: {
            alias: {}, // key - name, value - id
            deps: {}, // key - id, value - name/id
            urlPattern: null,
            comboPattern: null,
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

        var deps = 0, args = [];
        if (scrat.options.combo) {
            each(parseDeps(names), processor);
        } else {
            parseDeps(names, processor);
        }

        function processor(ids, ext) {
            if (ext === '.js' || ext === '.css') {
                ++deps;
                load(ids, function () {
                    if (--deps === 0) {
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

        if (extname(id) !== '.js') return;
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

    var EXT_RE = /(\.[^.]*)$/;
    function extname(path) {
        return EXT_RE.test(path) ? RegExp.$1 : '';
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
     * Calculate dependence of a list of ids
     * @param {string|array} ids
     * @param {function} [processor]
     * @private {object} [depends] - used in recursion
     * @private {array} [depended] - used in recursion
     * @returns {object} depends
     */
    function parseDeps(ids, processor, depends, depended) {
        if (type(ids) === 'string') ids = [ids];
        depends = depends || {};
        depended = depended || {};

        var deps = scrat.options.deps;
        each(ids, function (id, i) {
            id = ids[i] = parseAlias(id);
            if (scrat.modules[id] || depended[id]) return;
            var ext = extname(id);
            depends[ext] = depends[ext] || [];
            depends[ext].unshift(id);
            depended[id] = 1;
            if (deps[id]) parseDeps(deps[id], processor, depends, depended);
            if (type(processor) === 'function') processor(id, ext);
        });
        return depends;
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

        switch (extname(ids[0])) {
        case '.js':
            var loading = scrat.loading;
            each(ids, function (id, i) {
                id = ids[i] = parseAlias(id);
                var queue = loading[id] || (loading[id] = []);
                if (type(onload) === 'function') queue.push(onload);
            });
            loadResource(parseUrl(ids), true);
            break;
        case '.css':
            loadResource(parseUrl(ids), false, onload);
            break;
        default:
            each(ids, function (id) {
                loadResource(parseUrl(id), false, onload);
            });
        }
    }

    /**
     * Load any types of resources from specified url
     * @param {string} url
     * @param {boolean} [isScript = extname === '.js'] notice: combo-url may set to false
     * @param {function} [onload]
     */
    function loadResource(url, isScript, onload) {
        if (scrat.cacheUrl[url]) return;
        scrat.cacheUrl[url] = 1;

        var ext = extname(url);
        if (type(isScript) === 'function') onload = isScript;
        if (isScript || isScript !== false) isScript = ext === '.js';

        var head = document.getElementsByTagName('head')[0],
            node = document.createElement(isScript ? 'script' : 'link');

        if (isScript) {
            node.type = 'text/javascript';
            node.async = 'async';
            node.src = url;
        } else {
            if (ext === '.css') {
                node.type = 'text/css';
                node.rel = 'stylesheet';
            }
            node.href = url;
        }

        node.onload = node.onreadystatechange = function () {
            if (!node.readyState ||
                /loaded|complete/.test(node.readyState)) {
                node.onload = node.onreadystatechange = null;
                if (isScript && head && node.parentNode) {
                    head.removeChild(node);
                }
                node = null;
                if (type(onload) === 'function') {
                    onload();
                }
            }
        };
        head.insertBefore(node, head.firstChild);
    }

    global.require = scrat;
    global.define = scrat.define;
})(window);