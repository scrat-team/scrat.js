var childProcess = require("child_process")
var server = childProcess.spawn("node", ['./test/server'], { stdio: 'inherit' })
// var testing = childProcess.exec("mocha-phantomjs http://localhost:3001", function (err, stdout, stderr) {
childProcess.exec("phantomjs --version", function (err, stdout, stderr) {
    if (!err) console.log('phantomjs version ', stdout)
})
childProcess.exec("mocha-phantomjs --version", function (err, stdout, stderr) {
    if (!err) console.log('mocha-phantomjs version ', stdout)
})
var testing = childProcess.exec("mocha-phantomjs http://localhost:3001", function (err, stdout, stderr) {
    if (err) {
        console.log(err)
        throw new Error(err)
    }
    if (stderr) throw new Error(stderr)
    console.log(stdout)
    server.kill()
})
