# scroll
鄙人写的滚动条插件

require一下scroll.js 就行了
两个要放在一个目录下

# 使用方式
<div class="scroll-container" id="container">
  <div class="scroll-content" id="content">
    ...
    ...
  </div>
</div>

import scrollEventModule from "scroll.js"

var scroll = scrollEventModule({
  container: document.querySelector("#container"),
  content: document.querySelector("#content")
});

# 每当容器高度变化的时候
scroll.init();
