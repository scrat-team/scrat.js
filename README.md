Scrat.js
--------

## 介绍
Scrat.js 是与 [Scrat](https://github.com/scrat-team/scrat) 配套使用的前端模块管理框架，Scrat 通过 release 环节将计算出的模块列表、别名、依赖关系、配置等信息传递给 Scrat.js，由 Scrat.js 负责运行时的模块加载、合并请求、缓存等工作。

## 主要 API 说明
### require.async(modules, callback)
说明：加载并运行一组 JS 模块

- @param {string|array} modules - 要加载并运行的模块列表
- @param {function} callback - 全部模块及其依赖加载成功后的回调函数

示例：
```javascript
require.async(['ajax', 'event'], function (ajax, event) {
    ajax.get('/someObjs', {length: 10}, function (data) {
        event.emit('done', data);
    });
});
```

### require.config(options)
说明：设置并返回 Scrat.js 选项

- @param {object} [options] - 配置选项
- @returns {object} options

示例：
```javascript
require.config(__FRAMEWORK_CONFIG__); // Scrat 在编译过程中会自动替换 __FRAMEWORK_CONFIG__ 为配置数据
require.config({
    cache: true, // 开启 localStorage 缓存
    urlPattern: '/path/to/resources/%s', // 资源加载路径
    comboPattern: '/path/to/combo-service??%s' // Combo 服务路径
});
```

### define(id, factory, nocache)
说明：定义一个 JS 模块

- @param {string} id - 模块 id
- @param {function} factory - 模块的工厂函数
- @param {boolean} nocache - 为ture时候强制不cache

示例：
```javascript
define('hello', function (require, exports, module) {
    module.exports = function (name) {
        alert('Hello ' + name);
    };
});
```