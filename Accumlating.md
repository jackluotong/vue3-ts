<!--
 * @Description: 
 * @version: 1.0.0
 * @Author: william
 * @Date: 2021-10-11 16:18:25
 * @LastEditors: william
 * @LastEditTime: 2021-10-11 16:18:25
 * @For What?: 
-->
##
2021.10.08
	1.SDK与API?
	2.WebAssembly？
		概念：
			一种低级的类汇编语言，具有紧凑的二进制格式，可以接近原生的性能运行，并为诸如C / C ++等语言提供一个编译目标
		目标/特点：
			快速、高效、可移植
			可读、可调试
			保持安全-浏览器的同源策略和授权策略
			不破坏网络
		如何适应网络平台：
		网络浏览器的渲染引擎：
		工作流程：
			1.https://developer.mozilla.org/zh-CN/docs/WebAssembly/Concepts#webassembly%E7%9A%84%E7%9B%AE%E6%A0%87
		关键概念：
			1.Module
			2.Memory
			3.Table
			4.Instance
	3.WebRTC?
		概念：
		使用：
		API:
	4.WebSocket?
	
	5.ArrayBuffer SharedArrayBuffer WEB Worker
2021.10.09
	1.WebRTC
		作用：在两个设备之间经行实时得对等媒体交换
		特点：完全对等，实时交换音频、视频和数据、同时提供一个中心警告，自身不提供信令传递机制，可以使用WebSocket或者XMLHttpRequest
		概念：
			信令：发现和媒体格式协商，以使不同网络上得两个设备相互定位。	
			信令服务器：
				目的：两个设备之间建立WebRTC连接需要一个信令服务器来实现双方通过网络进行连接
				作用：信令服务器的作用是作为一个中间人帮助双方在尽可能少的暴露隐私的情况下建立连接。
			


	2.WebSocket
		出现：解决轮询的低效率，服务器<=>客户端
		特点：
			1.建立在tcp之上服务端实现比较容易
			2.与http协议有比较好的兼容性，握手阶段采用http，握手不易被屏蔽，可以通过各种http代理服务器
			3.数据格式比较轻量，性能开销小，通信高效
			4.可以发送文本，也可以发送二进制数据
			5.没有同源限制，客户端可以与任意服务器通信
			6.协议标识符是ws（如果加密是wss），服务器网址就是url
		通信原理和机制：
			1. 在客户端构建一个websocket实例，并且为它绑定一个需要连接到的服务器地址，当客户端连接服务端的时候，会向服务端发送一个类似下面的http报文
			
				GET /chat HTTP/1.1
				Host: server.example.com
				Upgrade: websocket
				Connection: Upgrade
				Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==
				Sec-WebSocket-Protocol: chat, superchat
				Sec-WebSocket-Version: 13
				Origin: http://example.com
			2.属性
				Socket.readyState
				Socket.bufferedAmount
			3.事件
				open->Socket.onopen
				message->Socket.onmessage
				error->Socket.onerror
				close->Socket.onclose
			4.方法
				Socket.send
				Socket.close
			5缺点
				不兼容低版本浏览器
	3.nginx
	4.switchhosts
	
2021.10.11
    1.