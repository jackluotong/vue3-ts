/*
 * @Description:
 * @version: 1.0.0
 * @Author:
 * @Date: 2021-10-09 14:41:34
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2021-10-09 14:41:34
 */
// from node.js sample
// https://nodejs.org/api/process.html#process_process_stdin
process.stdin.setEncoding('utf8')

process.stdin.on('readable', function () {
    var chunk = process.stdin.read()
    if (chunk !== null) {
        process.stdout.write('data: ' + chunk)
    }
})
