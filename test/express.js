/**
 *  https://gist.github.com/trevordixon/3061477
 */

'use strict';
var _ = {},
    ctor = function() {};
_.bind = function bind(func, context) {
    var bound, args, slice = Array.prototype.slice;
    args = slice.call(arguments, 2);
    return bound = function() {
        if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
        ctor.prototype = func.prototype;
        var self = new ctor;
        var result = func.apply(self, args.concat(slice.call(arguments)));
        if (Object(result) === result) return result;
        return self;
    };
};

var Res = function Res(res) {
    this.headers = res.headers || {};
    this.res = res;
    this.statusCode = res.statusCode;
};
Res.prototype.header = function(h, v) {
    if (v) return this.headers[h] = v;
    else return this.headers[h];
};
Res.prototype.send = function(body) {
    if (arguments.length == 2) {
        if (typeof body != 'number' && typeof arguments[1] == 'number') {
            this.statusCode = arguments[1];
        } else {
            this.statusCode = body;
            body = arguments[1];
        }
    }

    if (typeof body == 'number') {
        this.statusCode = body;
        body = '';
    } else if (typeof body == 'object') body = JSON.stringify(body);

    this.close(body);

    return this;
};
Res.prototype.write = function(data) {
    this.res.write(data);
    return this;
};
Res.prototype.redirect = function(url) {
    this.header('Location', url);
    this.send(301);
};
Res.prototype.close = function(data) {
    this.res.statusCode = this.statusCode;
    this.res.headers = this.headers || {};
    this.write(data);
    this.res.close();
    return this;
};

var R = function Routes() {
    this.server = require('webserver').create();
    this.routes = [];
};
R.prototype.preRoute = function(req, res) {
    this.router.call(this, req, new Res(res));
};
R.prototype.router = function(req, res, i) {
    var i = i || 0;

    for (i; i < this.routes.length; i++) {
        var route = this.routes[i];
        if (route.method == 'ALL' || route.method == req.method) {
            var path = req.url.split('?')[0]
            var match = path.match(route.route);
            if (match) {
                req.params = match.slice(1);
                try {
                    return route.handler.call(this, req, res, _.bind(this.router, this, req, res, ++i));
                } catch (err) {
                    console.log(err.stack);
                    return res.send(err.stack, 500);
                }
            }
        }
    }

    res.send('Not found', 404);
};
R.prototype.addRoute = function(method, route, handler) {
    if (!(route instanceof RegExp)) route = new RegExp("^" + route + "$");
    this.routes.push({
        method: method,
        route: route,
        handler: handler
    });
};
R.prototype.all = function(route, handler) {
    this.addRoute('ALL', route, handler);
};
R.prototype.get = function(route, handler) {
    this.addRoute('GET', route, handler);
};
R.prototype.post = function(route, handler) {
    this.addRoute('POST', route, handler);
};
R.prototype.head = function(route, handler) {
    this.addRoute('HEAD', route, handler);
};
R.prototype.put = function(route, handler) {
    this.addRoute('PUT', route, handler);
};
R.prototype.delete = function(route, handler) {
    this.addRoute('DELETE', route, handler);
};
R.prototype.use = function(handler) {
    this.addRoute('ALL', /.+/, handler);
};
R.prototype.listen = function(port, done) {
    this.server.listen(port, _.bind(this.preRoute, this));
};

R.static = function(root) {
    var fs = require('fs'),
        root = fs.absolute(root);

    return function(req, res, next) {
        if (req.method != 'GET') return next();

        var resource = req.url.slice(1),
            path = root + '/' + resource;

        if (resource && fs.isFile(path) && fs.isReadable(path)) {
            var file = fs.read(path);
            res.send(file);
        } else {
            next();
        }
    }
};

module.exports = R;
