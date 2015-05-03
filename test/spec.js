describe('#scrat.config', function () {
    require.config({
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
    })
    it('set scrat options', function () {
        expect(require.options.hash).to.equal('xxxxxxx')
        expect(require.options.alias.config).to.equal('config')
    })
})
describe('#scrat.define', function () {
    it('define a module and use with require.async', function (done) {
        require.define('config', function(require, exprots, module) {
            module.exports = {
                api: '/api'
            }
        })
        require.async('config', function (c) {
            expect(c.api).to.equal('/api')
            done()
        })
    })
})
describe('#scrat.async', function () {
    it('use require.async to require a module from remote', function (done) {
        require.async('pages/p-index', function (p) {
            expect(p.name).to.equal('p-index')
            done()
        })
    })
})