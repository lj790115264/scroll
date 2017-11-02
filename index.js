require("./scroll.css");
/*
 * config: container 容器对象
 *          content 内容对象
 *          update
 */

 /*
  * config: container 容器对象
  *          content 内容对象
  *          update
  */
  // 建议： 后面版本添加一个接口，在执行动画的时候保持住状态，不修改值，动画结束后再修改值
var scrollEventModule = (function() {
    var log = console.log.bind(console)
    var sameTimeEvent = false;
    return function(config) {
        var goClickTimeout;
        var my = {};
        var focusHas = false;
        var container = config.container;
        var content = config.content;
        var startX = 0;
        var startY = 0;
        var start = {
            X: 0,
            Y: 0,
        }, move = {
            X: 0,
            Y: 0,
        }, trans = { // 结束的时候保存下来的当前这一次操作。内容的偏移量
            X: 0,
            Y: 0,
        }, beforeEnd = { // touchmove的时候要记录下当前的坐标，给下一次的调用计算速度
            X: 0,
            Y: 0,
        };
        var speedV = { // 存放速度的数组，存放3次速度，用于在touchend的时候计算平均速度
            X: [],
            Y: [],
        };
        var downText = "";
        var upText = "";
        var unlinkText = "";
        var upUnlinkText = "";
        var updateText = "";
        var loadText = "";
        var refreshMax = 60;
        var backSpeed = 1.2;     // 回弹的衰减系数   下阀值回弹： 偏移距离 = 下阀值 + (当前偏移距离 - 下阀值) / 系数 + 1
        //  上阀值回弹: 偏移距离 = 当前偏移距离 / 系数 - 1
        var doThing = false;
        var moveAllowMax = 40;   // 脱手时候的最大速度
        var moveAllowMin = 4;    // 判定是滚动的最小值 如果速度小于这个值，认为不是滚动操作
        var scrollDistance = 0.4; // 滚动系数， 滚动后偏移距离 = 当前偏移距离 + 速度 * 滚动系数
        var overDrag = 3;       // 超出上下阀值的时候，增加的速度的衰减值
        var requestAnimateId;  // 存放动画帧
        var contentHeight = 0;  //内容所占实际高度
        var containerHeight = 0;
        var transformDistance = 0; // 容器 - 内容高度 = 容器可滚动的最大距离 （滚动的下阀值）
        var directionXY = config.direction || "Y";

        var contentWidth = 0;
        var containerWidth = 0;
        var transformDistanceX = 0;
        var moveDirection = "Y";
        var moveDirectionList = [];

        var changeDirectionCache = {
            X: 0,
            Y: 0,
        }
        var whenChangeDirection = {
            X: 0,
            Y: 0,
        }

        var eventListener = {
            scrolling: "",
            update: "",
            load: "",
        }
        my.addEvent = function(event, done) { // 添加监听事件
            eventListener[event] = done;
            init();
        }
        my.removeEvent = function(event) {
            eventListener[event] = "";
            init();
        }
        function directionAvg() {
            var x = 0;
            var y = 0;
            moveDirectionList.forEach(function(item) {
                if (item == "X") {
                    x ++;
                } else {
                    y ++;
                }
            });
            if (x > y) {
                return "X";
            } else {
                return "Y";
            }
        }
        function averageMove(list) { // 计算数组的平均值 如果存在0，平均值就是0
            var sum = 0;
            var length = 0;
            for (var i = 0; i < list.length; i++) {
                if (list[i] != 0) {
                    sum += list[i];
                    length ++;
                }
            }
            if (length != list.length) {
                return 0;
            } else {
                return sum / length;
            }
        }
        function stop() { // 停止动画，并且初始化速度数组
            cancelAnimationFrame(requestAnimateId);
            for (var i = 0; i < 3; i++) { // 存放速度的数组，存放3次速度，用于在touchend的时候计算平均速度
                speedV.X[i] = 0;
                speedV.Y[i] = 0;
            }
            trans.X = move.X;
            trans.Y = move.Y;
            changeDirectionCache = {
                X: 0,
                Y: 0,
            }
            if (!doThing) {
                content.setAttribute("stateName", downText);
                content.setAttribute("stateNameDown", upText);
            }
        }
        function init() { // 初始化阀值和内容高度 ，当内容高度变化的时候，需要重新调用该方法计算阀值和内容高度
            var containerStyle = window.getComputedStyle(container, null);
            var contentStyle = window.getComputedStyle(content, null);
            if (containerStyle.boxSizing == "border-box") {
                containerHeight = parseInt(containerStyle.height) - parseInt(containerStyle.paddingTop) - parseInt(containerStyle.paddingBottom);
            } else {
                containerHeight = parseInt(containerStyle.height);
            }  // 容器所占高度
            if (contentStyle.boxSizing == "border-box") {
                contentHeight = parseInt(contentStyle.height) + parseInt(contentStyle.marginTop) + parseInt(contentStyle.marginBottom);
                contentWidth = parseInt(contentStyle.width) + parseInt(contentStyle.marginLeft) + parseInt(contentStyle.marginRight);
            } else {
                contentHeight = parseInt(contentStyle.height) + parseInt(contentStyle.paddingTop) + parseInt(contentStyle.paddingBottom) + parseInt(contentStyle.marginTop) + parseInt(contentStyle.marginBottom);
                contentWidth = parseInt(contentStyle.width) + parseInt(contentStyle.paddingLeft) + parseInt(contentStyle.paddingRight) + parseInt(contentStyle.marginLeft) + parseInt(contentStyle.marginRight);
            }
            transformDistance = containerHeight - contentHeight;
            transformDistanceX = config.width;
            if (transformDistance > move.Y && transformDistance < 0) {
                backAnimate(transformDistance, transformDistance);
            }
            if (transformDistance < 0) {
                downText = typeof eventListener.update == "function"  && "下拉刷新" || "";
                upText = typeof eventListener.load == "function" && "上拉加载" || "";
                unlinkText = typeof eventListener.update == "function" && "松开刷新" || "";
                upUnlinkText = typeof eventListener.load == "function" && "松开加载" || "";
                updateText = typeof eventListener.update == "function" && "更新中" || "";
                loadText = typeof eventListener.load == "function" && "更新中" || "";
            } else {
                content.style.webkitTransform = "translate3d(0, 0, 0)";
            }
        }
        function backAnimate(distance, startDistance) {
            if (distance > 0) {
                distance = move.Y = distance / backSpeed - 1;
            } else if (distance < 0) {
                distance = move.Y = transformDistance + (distance - transformDistance) / backSpeed + 1;
            }
            moveAnimate();
            if (distance < 0 && distance > transformDistance) {
                if (distance < 0 && startDistance > 0) { // 下拉回弹到头
                    move.Y = 0;
                } else if (distance > transformDistance) {  // 上拉回弹到头
                    move.Y = transformDistance;
                }
                cancelAnimationFrame(requestAnimateId);
                moveAnimate();
            } else {
                requestAnimateId = requestAnimationFrame(backAnimate.bind(null, distance, startDistance));
            }
        }
        my.backAnimate = backAnimate;
        init();
        // 下面这个监听事件，阻止touche事件穿过body冒泡至 webview 产生 微信下拉出来的一块黑色的东西
        container.parentNode.addEventListener("touchmove", function() {
            event.preventDefault();
        });
        container.addEventListener("touchstart", function() {
            if (sameTimeEvent != container && sameTimeEvent) {
                return;
            }
            sameTimeEvent = container;
            var event = window.event.targetTouches[0];
            start.Y = event.pageY;
            start.X = event.pageX;
            stop();
        })
        container.addEventListener("touchmove", function() {
            if (sameTimeEvent != container && sameTimeEvent) {
                return;
            }
            var event = window.event.targetTouches[0];
            var offsetX = event.pageX - start.X;
            var offsetY = event.pageY - start.Y;

            speedV.Y.shift();
            speedV.Y.push(event.pageY - beforeEnd.Y);
            beforeEnd.Y = event.pageY;
            speedV.X.shift();
            speedV.X.push(event.pageX - beforeEnd.X);
            beforeEnd.X = event.pageX;
            if (Math.abs(speedV.Y[2]) < Math.abs(speedV.X[2])) {
                moveDirection = "X";
            } else {
                moveDirection = "Y";
            }
            moveDirectionList.push(moveDirection);
            if (moveDirectionList.length > 3) {
                moveDirectionList.shift();
            }
            if (directionXY == "Y") {
                if (directionAvg() == "Y") {
                    if (transformDistance < 0) { // 只有当下阀值小于0的时候才会调用动画
                        moveAnimate();
                    }
                    var distance = trans.Y + offsetY;
                    if (distance > 0) {
                        distance = Math.sqrt(distance) * 6;
                    } else if (distance < transformDistance) {
                        distance = transformDistance - Math.sqrt(transformDistance - distance) * 6
                    }
                    move.Y = distance;
                    if (!doThing) {
                        if (move.Y > refreshMax) {
                            content.setAttribute("stateName", unlinkText);
                        } else if (move.Y < refreshMax && move.Y > 0) {
                            content.setAttribute("stateName", downText);
                        } else if (move.Y < transformDistance - refreshMax) {
                            content.setAttribute("stateNameDown", upUnlinkText);
                        } else if (move.Y > transformDistance - refreshMax && move.Y < transformDistance) {
                            content.setAttribute("stateNameDown", upText);
                        }
                    }
                } else {
                }
            } else {
                if (directionAvg() == "X") {
                    if (transformDistanceX < 0) {
                        moveAnimate();
                    }
                    var distance = trans.X + offsetX;
                    move.X = distance;
                } else {

                }
            }
        })
        container.addEventListener("touchend", function() {
            var event = window.event;
            setTimeout(function() { // 2017.02.22 手势操作的代码，应该在所有的dom生成完毕之后再执行，所以把判断代码放到异步队列的最后
                if (sameTimeEvent != container && sameTimeEvent) {
                    return;
                }
                sameTimeEvent = false;

                focusHas = false;
                var over = false; // 是否超出滚动上下阀值
                var direction = 1; // 方向为1 ，向上， -1 ,向下
                var speedAbsV; // 速度的绝对值
                if (directionXY == "Y") {
                    var speedAver = averageMove(speedV.Y);  // 根据速度数组计算脱手速度
                    // 当滚动下阀值小于0 且 内容仍然处于滚动的范围以内
                    var tag = 0;
                    // 只要一段时间内有一个值为0 判定触摸时间太少，作为点击事件的一个判断条件
                    for (var i = 0; i < speedV.Y.length; i++) {
                        if (speedV.Y[i] == 0) {
                            tag = 1;
                        }
                    }

                    if (tag == 1 && trans.Y == move.Y) { // 点击事件的判断条件

                    } else { // 判定为不是点击事件则删除事件计时器（即使计时器时间为0，依旧会受到这段代码的限制）
                        clearTimeout(goClickTimeout);
                    }

                    if (transformDistance < 0 && move.Y < 0 && move.Y > transformDistance) {
                        if (speedAver > 0) {
                            direction = 1;
                            speedAbsV = speedAver;
                        } else {
                            direction = -1;
                            speedAbsV = Math.abs(speedAver);
                        }
                        if (speedAbsV > moveAllowMin && speedAbsV < moveAllowMax) { // 如果速度太快就限制
                            speedAbsV = moveAllowMax;
                        } else if (speedAbsV <=  moveAllowMin) { // 如果太慢就设为0
                            speedAbsV = 0;
                        }
                        animate(speedAbsV);
                        // 超过滚动上下阀值， 判断这时候为手动拖动至超出距离
                    } else if ((move.Y > 0 || (move.Y < transformDistance && transformDistance < 0))) {
                        if (move.Y > 0) {
                            direction = -1;
                            if (move.Y > refreshMax) { // 超出刷新判定值，判断为下拉刷新
                                if (!doThing) { // 有没有更新操作
                                    content.setAttribute("stateName", updateText);
                                }
                                updateFinish();
                            } else if (!doThing) {
                                backAnimate(move.Y, move.Y);
                            }
                        } else {
                            direction = 1;
                            if (move.Y < transformDistance - refreshMax) { // 超出刷新判定值，判断为上拉加载
                                if (!doThing) {
                                    content.setAttribute("stateNameDown", loadText);
                                }
                                loadFinish();
                            } else if (!doThing) {
                                backAnimate(move.Y, move.Y);
                            }
                        }
                    }
                } else if (directionXY == "X" && directionAvg() == "X") {
                    var speedAver = averageMove(speedV.X);  // 根据速度数组计算脱手速度
                    // 当滚动下阀值小于0 且 内容仍然处于滚动的范围以内
                    var tag = 0;
                    // 只要一段时间内有一个值为0 判定触摸时间太少，作为点击事件的一个判断条件
                    for (var i = 0; i < speedV.X.length; i++) {
                        if (speedV.X[i] == 0) {
                            tag = 1;
                        }
                    }
                    if (transformDistanceX < 0 && move.X < 0 && move.X > transformDistanceX) {

                        if (speedAver > 0) {
                            direction = 1;
                            speedAbsV = speedAver;
                        } else {
                            direction = -1;
                            speedAbsV = Math.abs(speedAver);
                        }
                        if (speedAbsV > moveAllowMin && speedAbsV < moveAllowMax) { // 如果速度太快就限制
                            speedAbsV = moveAllowMax;
                        } else if (speedAbsV <=  moveAllowMin) { // 如果太慢就设为0
                            speedAbsV = 0;
                        }
                        animate(speedAbsV);
                        // 超过滚动上下阀值， 判断这时候为手动拖动至超出距离
                    }
                }
                function loadFinish() {
                    doThing = true;
                    var startMoveY = move.Y;
                    my.doSuccess = function() {
                        doThing = false;
                    }
                    function slowDone() {
                        move.Y += 10;
                        if (move.Y >= transformDistance - refreshMax / 1.25) {
                            move.Y = transformDistance - refreshMax / 1.25;
                            cancelAnimationFrame(requestAnimateId);
                            if (typeof eventListener.load == "function") {
                                eventListener.load()
                            } else {
                                my.doSuccess();
                                backAnimate(move.Y, startMoveY);
                            }
                        } else {
                            moveAnimate();
                            requestAnimateId = requestAnimationFrame(slowDone);
                        }
                    }
                    slowDone();
                }
                function updateFinish() {
                    doThing = true;
                    var startMoveY = move.Y;
                    my.doSuccess = function() {
                        doThing = false;
                        backAnimate(move.Y, startMoveY);
                    }
                    function slowDone() {
                        move.Y -= 10;
                        if (move.Y <= refreshMax / 1.25) {
                            move.Y = refreshMax / 1.25;
                            cancelAnimationFrame(requestAnimateId);
                            if (typeof eventListener.update == "function") {
                                eventListener.update()
                            } else {
                                my.doSuccess();
                            }
                        } else {
                            moveAnimate();
                            requestAnimateId = requestAnimationFrame(slowDone);
                        }
                    }
                    slowDone();
                }
                function animate(speedAbsV) {
                    speedAbsV -= 1; // 每次减少一的速度
                    if (directionXY == 'Y') {
                        if (speedAbsV <= 0 || isNaN(speedAbsV)) { // 当速度为0的时候停止当前动画，并且调用回弹动画
                            speedAbsV = 0;
                            cancelAnimationFrame(requestAnimateId);
                            stop();
                            if (over) {  // 判断是否需要调用回弹
                                var overDistance = move.Y;
                                backAnimate(overDistance, overDistance);
                            }
                        } else {
                            over = moveAnimate();  // 返回当前有没有超出上边界或者下边界
                            if (direction > 0) {
                                move.Y = move.Y + speedAbsV * scrollDistance;
                            } else {
                                move.Y = move.Y - speedAbsV * scrollDistance;
                            }
                            if (over) {  // 如果超出了边界的话 增加每祯减少的速度值
                                if (speedAbsV > moveAllowMax) {
                                    speedAbsV = moveAllowMax
                                }
                                speedAbsV -= overDrag;
                            }
                            requestAnimateId = requestAnimationFrame(animate.bind(null, speedAbsV));
                        }
                    } else {
                        if (speedAbsV <= 0 || isNaN(speedAbsV)) { // 当速度为0的时候停止当前动画，并且调用回弹动画
                            speedAbsV = 0;
                            cancelAnimationFrame(requestAnimateId);
                            stop();
                        } else {
                            over = moveAnimate();  // 返回当前有没有超出上边界或者下边界
                            if (direction > 0) {
                                move.X = move.X + speedAbsV * scrollDistance;
                            } else {
                                move.X = move.X - speedAbsV * scrollDistance;
                            }
                            requestAnimateId = requestAnimationFrame(animate.bind(null, speedAbsV));
                        }
                    }
                }
            }, 0)

        })
        function moveAnimate(dis) {
            var _distance = dis || move;
            if (directionXY == "Y") {
                if (transformDistance < 0) {
                    typeof eventListener.scrolling == "function" && eventListener.scrolling();
                    content.style.webkitTransform = "translate3d(" + _distance.X + "px , " + _distance.Y + "px, 0)";
                }
                my.scrollDistance = move;
                if (move.Y > 0 || move.Y < transformDistance) {
                    return true;
                } else {
                    return false;
                }
            } else {
                if (move.X > 0) {
                    move.X = 0;
                }
                if (move.X < transformDistanceX) {
                    move.X = transformDistanceX
                }
                if (transformDistanceX < 0) {
                    typeof eventListener.scrolling == "function" && eventListener.scrolling();
                    content.style.webkitTransform = "translate3d(" + _distance.X + "px , " + _distance.Y + "px, 0)";
                }
            }
        }
        my.init = init;
        my.scrollDistance = move;
        my.setScroll = function(dis) {
            if (dis.X != undefined) {
                move.X = dis.X
            }
            if (dis.Y != undefined) {
                move.Y = dis.Y;
            }
            moveAnimate();
        }
        return my;
    }
})();
module.exports = scrollEventModule;
