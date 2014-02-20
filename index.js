(function (global) {
    'use strict';

    var scrat = global.scrat = {
        options: {
            alias: {}, // key - name, value - id
            deps: {}, // key - id, value - name/id
            urlPattern: null,
            combo: false
        },
        modules: {}, // key - id
        loading: {}, // key - id
        cacheUrl: {}
    };

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

    scrat.async = function (names, onload) {
        if (type(names) === 'string') names = [names];

        var deps = 0, args = [];
        if (scrat.options.combo) {
            loadScript(parseDeps(names), function () {
                each(names, function (name) {
                    args.push(require(name));
                });
                onload && onload.apply(scrat, args);
            });
        } else {
            parseDeps(names, function (id) {
                ++deps;
                loadScript(id, function () {
                    if (--deps === 0) {
                        each(names, function (name) {
                            args.push(require(name));
                        });
                        onload && onload.apply(scrat, args);
                    }
                });
            });
        }
    };

    function require(name) {
        var id = parseAlias(name),
            module = scrat.modules[id];

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
        var type;
        if (obj == null) {
            type = String(obj);
        } else {
            type = Object.prototype.toString.call(obj).toLowerCase();
            type = type.substring(8, type.length - 1);
        }
        return type;
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

    function parseUrl(ids) {
        if (type(ids) === 'string') ids = [ids];
        each(ids, function (id, i) {
            ids[i] = parseAlias(id);
        });

        var url = scrat.options.urlPattern;
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

    function parseDeps(ids, processor, depends, depended) {
        if (type(ids) === 'string') ids = [ids];
        depends = depends || [];
        depended = depended || {};

        var deps = scrat.options.deps;
        each(ids, function (id, i) {
            id = ids[i] = parseAlias(id);
            if (id in scrat.modules || id in depended) return;
            depends.unshift(id);
            depended[id] = 1;
            if (type(processor) === 'function') processor(id);
            if (id in deps) parseDeps(id, processor, depends, depended);
        });
        return depends;
    }

    function loadScript(ids, onload) {
        if (type(ids) === 'string') ids = [ids];

        var loading = scrat.loading;
        each(ids, function (id, i) {
            id = ids[i] = parseAlias(id);
            var queue = loading[id] || (loading[id] = []);
            queue.push(onload);
        });
        return createScript(parseUrl(ids));
    }

    function createScript(url, onload) {
        if (url in scrat.cacheUrl) return;
        scrat.cacheUrl[url] = 1;

        var head = document.getElementsByTagName('head')[0],
            script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = 'async';
        script.src = url;
        script.onload = script.onreadystatechange = function () {
            if (!script.readyState ||
                /loaded|complete/.test(script.readyState)) {
                script.onload = script.onreadystatechange = null;
                if (head && script.parentNode) {
                    head.removeChild(script);
                }
                script = null;
                if (type(onload) === 'function') {
                    onload();
                }
            }
        };
        head.insertBefore(script, head.firstChild);
        return script;
    }
})(window);