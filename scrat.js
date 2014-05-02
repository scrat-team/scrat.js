(function (global, undefined) {
    'use strict';

    var slice = Array.prototype.slice,
        localStorage = global.localStorage,
        proto = {},
        scrat = create(proto);

    scrat.version = '0.3.0';
    scrat.options = {
        prefix: '__SCRAT__',
        cache: true, // must use with `scrat release -m`
        timeout: 15, // seconds
        alias: {}, // key - name, value - id
        deps: {}, // key - id, value - name/id
        urlPattern: null, // '/path/to/resources/%s'
        comboPattern: null, // '/path/to/combo-service/%s' or function (ids) { return url; }
        combo: false
    };
    scrat.cache = {}; // key - id

    /**
     * Mix obj to scrat.options
     * @param {object} obj
     */
    proto.config = function (obj) {
        var options = scrat.options;

        debug('scrat.config', obj);
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

        // detect localStorage support and activate cache ability
        try {
            if (options.hash !== localStorage.getItem('__SCRAT_HASH__')) {
                scrat.clean();
                localStorage.setItem('__SCRAT_HASH__', options.hash);
            }
            options.cache = options.cache && !!options.hash;
        } catch (e) {
            options.cache = false;
        }

        return options;
    };

    /**
     * Require modules asynchronously with a callback
     * @param {string|array} names
     * @param {function} onload
     */
    proto.async = function (names, onload) {
        if (type(names) === 'string') names = [names];
        debug('scrat.async', 'require [' + names.join(', ') + ']');

        var reactor = new scrat.Reactor(names, function () {
            var args = [];
            each(names, function (id) {
                args.push(require(id));
            });
            onload.apply(scrat, args);
            debug('scrat.async', '[' + names.join(', ') + '] callback called');
        });
        reactor.run();
    };

    /**
     * Define a module with a factory funciton or any types of value
     * @param {string} id
     * @param {*} factory
     */
    proto.define = function (id, factory) {
        debug('scrat.define', '[' + id + ']');
        var options = scrat.options,
            res = scrat.cache[id];
        if (res) {
            res.factory = factory;
        } else {
            scrat.cache[id] = {
                id: id,
                loaded: true,
                factory: factory
            };
        }
        if (options.cache) {
            localStorage.setItem(options.prefix + id, factory.toString());
        }
    };

    /**
     * Get a defined module
     * @param {string} id
     * @returns {object} module
     */
    proto.get = function (id) {
        debug('scrat.get', '[' + id + ']');
        var options = scrat.options,
            res = scrat.cache[id],
            factoryRaw;
        if (res) {
            return res;
        } else if (options.cache) {
            factoryRaw = localStorage.getItem(options.prefix + id);
            if (factoryRaw) {
                window['eval'].call(window, 'define("' + id + '",' + factoryRaw + ')');
                scrat.cache[id].loaded = false;
                return scrat.cache[id];
            }
        }
        return null;
    };

    /**
     * Clean module cache in localStorage
     */
    proto.clean = function () {
        debug('scrat.clean');
        try {
            each(localStorage, function (_, key) {
                if (~key.indexOf(scrat.options.prefix)) {
                    localStorage.removeItem(key);
                }
            });
            localStorage.removeItem('__SCRAT_HASH__');
        } catch (e) {}
    };

    /**
     * Get alias from specified name recursively
     * @param {string} name
     * @param {string|function} [alias] - set alias
     * @returns {string} name
     */
    proto.alias = function (name, alias) {
        var aliasMap = scrat.options.alias;

        if (arguments.length > 1) {
            aliasMap[name] = alias;
            return scrat.alias(name);
        }

        while (aliasMap[name] && name !== aliasMap[name]) {
            switch (type(aliasMap[name])) {
            case 'function':
                name = aliasMap[name](name);
                break;
            case 'string':
                name = aliasMap[name];
                break;
            }
        }
        return name;
    };

    /**
     * Load any types of resources from specified url
     * @param {string} url
     * @param {function|object} [onload|options]
     */
    proto.load = function (url, options) {
        if (type(options) === 'function') options = {onload: options};

        var t = options.type || fileType(url),
            isScript = t === 'js',
            isCss = t === 'css',
            isOldWebKit = +navigator.userAgent
                .replace(/.*AppleWebKit\/(\d+)\..*/, '$1') < 536,

            head = document.getElementsByTagName('head')[0],
            node = document.createElement(isScript ? 'script' : 'link'),
            supportOnload = 'onload' in node,
            tid = setTimeout(onerror, (options.timeout || 15) * 1000),
            intId, intTimer;

        if (isScript) {
            node.type = 'text/javascript';
            node.async = 'async';
            node.src = url;
        } else {
            if (isCss) {
                node.type = 'text/css';
                node.rel = 'stylesheet';
            }
            node.href = url;
        }

        node.onload = node.onreadystatechange = function () {
            if (!node.readyState ||
                /loaded|complete/.test(node.readyState)) {
                clearTimeout(tid);
                node.onload = node.onreadystatechange = null;
                if (isScript && head && node.parentNode) head.removeChild(node);
                if (options.onload) options.onload.call(scrat);
                node = null;
            }
        };

        node.onerror = function onerror() {
            clearTimeout(tid);
            clearInterval(intId);
            throw new Error('Error loading url: ' + url);
        };

        debug('scrat.load', '[' + url + ']');
        head.insertBefore(node, head.firstChild);

        // trigger onload immediately after nonscript node insertion
        if (isCss) {
            if (isOldWebKit || !supportOnload) {
                debug('scrat.load', 'check css\'s loading status for compatible');
                intTimer = 0;
                intId = setInterval(function () {
                    if ((intTimer += 20) > options.timeout || !node) {
                        clearTimeout(tid);
                        clearInterval(intId);
                        return;
                    }
                    if (node.sheet) {
                        clearTimeout(tid);
                        clearInterval(intId);
                        if (options.onload) options.onload.call(scrat);
                        node = null;
                    }
                }, 20);
            }
        } else if (!isScript) {
            if (options.onload) options.onload.call(scrat);
        }
    };

    proto.Reactor = function (names, callback) {
        this.length = 0;
        this.depends = {};
        this.depended = {};
        this.push.apply(this, names);
        this.callback = callback;
    };

    var rproto = scrat.Reactor.prototype;

    rproto.push = function () {
        var that = this,
            args = slice.call(arguments);

        function onload() {
            if (--that.length === 0) that.callback();
        }

        each(args, function (arg) {
            var id = scrat.alias(arg),
                type = fileType(id),
                res = scrat.get(id);

            if (!res) {
                res = scrat.cache[id] = {
                    id: id,
                    loaded: false,
                    onload: []
                };
            } else if (that.depended[id] || res.loaded) return;

            that.depended[id] = 1;
            that.push.apply(that, scrat.options.deps[id]);

            if (type === 'css' || (type === 'js' && !res.factory && !res.exports)) {
                (that.depends[type] || (that.depends[type] = [])).push(res);
                ++that.length;
                res.onload.push(onload);
            }
        });
    };

    rproto.run = function () {
        var that = this,
            options = scrat.options,
            combo = options.combo,
            depends = this.depends;

        if (this.length === 0) return this.callback();
        debug('reactor.run', depends);

        each(depends.unknown, function (res) {
            scrat.load(that.genUrl(res.id), function () {
                res.loaded = true;
            });
        });

        debug('reactor.run', 'combo: ' + combo);
        if (combo) {
            each(['css', 'js'], function (type) {
                var ids = [];
                each(depends[type], function (res) {
                    ids.push(res.id);
                });
                if (ids.length) {
                    scrat.load(that.genUrl(ids), function () {
                        each(depends[type], function (res) {
                            res.loaded = true;
                            while (res.onload.length) {
                                var onload = res.onload.shift();
                                onload.call(res);
                            }
                        });
                    });
                }
            });
        } else {
            each((depends.css || []).concat(depends.js || []), function (res) {
                scrat.load(that.genUrl(res.id), function () {
                    res.loaded = true;
                    while (res.onload.length) {
                        var onload = res.onload.shift();
                        onload.call(res);
                    }
                });
            });
        }
    };

    rproto.genUrl = function (ids) {
        if (type(ids) === 'string') ids = [ids];

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

        if (!options.cache) {
            url = url + (~url.indexOf('?') ? '&' : '?') + (+new Date());
        }
        return url;
    };

    /**
     * Require another module in factory
     * @param {string} name
     * @returns {*} exports
     */
    function require(name) {
        var id = scrat.alias(name),
            module = scrat.get(id);

        if (fileType(id) !== 'js') return;
        if (!module) throw new Error('failed to require "' + name + '"');

        if (!module.exports) {
            if (type(module.factory) !== 'function') {
                throw new Error('failed to require "' + name + '"');
            }
            module.factory.call(scrat, require, module.exports = {}, module);
            delete module.factory;
            debug('require', '[' + id + '] factory called');
        }
        return module.exports;
    }

    // Mix scrat's prototype to require
    each(proto, function (m, k) { require[k] = m; });

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

    var TYPE_RE = /(?:\.)(\w+)(?:[?&,]|$)/g;
    function fileType(str) {
        var ext = 'js',
            match = str.match(TYPE_RE);
        if (match && match.length) ext = RegExp.$1;
        if (ext === 'json') ext = 'js';
        else if (ext !== 'js' && ext !== 'css') ext = 'unknown';
        return ext;
    }

    var _modCache;
    function debug() {
        var flag = (global.localStorage || {}).debug,
            args = slice.call(arguments),
            style = 'color: #bada55',
            mod = args.shift(),
            re = new RegExp(mod.replace(/[.\/\\]/g, function (m) {
                return '\\' + m;
            }));
        mod = '%c' + mod;
        if (flag && flag === '*' || re.test(flag)) {
            if (_modCache !== mod) {
                console.groupEnd(_modCache, style);
                console.group(_modCache = mod, style);
            }
            if (/string|number|boolean/.test(type(args[0]))) {
                args[0] = '%c' + args[0];
                args.splice(1, 0, style);
            }
            console.log.apply(console, args);
        }
    }

    global.require = scrat;
    global.define = scrat.define;
})(this);