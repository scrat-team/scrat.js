'use strict';

var express = require('express')
var path = require('path')
var fs = require('fs')
var app = express()

var jsCode = 'define("%s", function(require, exports, module){ module.exports = {} })'
var cssCode = 'html {}'
var cssJSCode = 'require.defineCSS("%s", "html {}"'
    /**
     *  static folder
     **/
app.use(express.static(path.join(__dirname, '../')))

app.get('/', function(req, res) {
    res.send(fs.readFileSync(path.join(__dirname, './runner.html'), 'utf-8').replace('__FRAMEWORK_CONFIG__', JSON.stringify({
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

/**
 *  server and port
 **/
var port = process.env.PORT || 3001

app.listen(port, function() {
    console.log('Server is listen on port', port)
})
