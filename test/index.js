var webPage = require('webpage');
var page = webPage.create();
var webserver = require('webserver');
var server = webserver.create();
var fs = require('fs');
var express = require('./express')
var port = 3001
var url = 'http://localhost:' + port
var app = new express();

var jsCode = 'define("%s", function(require, exports, module){ module.exports = {} })'
var cssCode = 'html {}'
var cssJSCode = 'require.defineCSS("%s", "html {}"'

app.use(express.static('../'));
app.get('/', function(req, res) {
    res.send(fs.read('./runner.html').replace('__FRAMEWORK_CONFIG__', JSON.stringify({
        "cache": true,
        "urlPattern": "/c/%s",
        "comboPattern": "/co??%s",
        "alias": {
            "config": "config",
            "common/functions": "demo/1.1.1/common/functions/functions.js",
            "pages/p-index": "demo/1.1.1/pages/p-index/p-index.js"
        },
        "version": "1.1.1",
        "name": "nba",
        "combo": true,
        "hash": "xxxxxxx",
        "deps": {
            "pages/p-index": ["pages/p-index", "demo/1.1.1/pages/p-index/p-index.css", "common/functions"]
        }
    })))
})
app.get('/co', function(req, res) {
    var i = req.url.indexOf('??')
    if (~i) {
        var combo = req.url.slice(i + 2).split('&')
        var hash = combo[1]
        var files = combo[0].split(',')
        var comboFiles = files.map(function(f) {
            if (/\.css\.js/.test(f)) return cssCode.replace('$s', f.replace(/\.js$/, ''))
            else if (/\.js$/.test(f)) return jsCode.replace('%s', f)
            else if (/\.css$/.test(f)) return cssCode
            return ''
        })
        res.send(comboFiles.join('\n'))
    } else {
        res.send(500, 'fail')
    }
})
app.listen(port)

function exit() {
    app.server.close()
    phantom.exit()
}

page.onConsoleMessage = function(msg, lineNum, sourceId) {
    console.log('CONSOLE: ' + msg)
}
page.open(url + '/', function(status) {
    // var defineExist = page.evaluate(function() {
    //     return !!define;
    // });
    // console.log(defineExist)
    exit()
})
