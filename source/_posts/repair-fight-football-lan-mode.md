---
title: 修复十年前快牙游戏《格斗足球》的局域网联机
date: 2026-07-09 21:20:00
index_img: https://fastly.jsdelivr.net/gh/KingPenguinMan/image-bed/img/football-lan-fix/host-room-created.png
banner_img: https://fastly.jsdelivr.net/gh/KingPenguinMan/image-bed/img/football-lan-fix/host-room-created.png
tags:
  - Android
  - APK
  - Smali
  - 局域网联机
  - 逆向调试
categories:
  - bug
excerpt: 记录一次旧 Android 游戏联机功能修复：保留原生 native 比赛同步逻辑，替换失效的快牙 SDK 房间发现和加入流程，让十年前的《格斗足球》重新完成局域网联机。
---

## 背景

这次修的是一个已经很久没人维护的 Android 游戏：《格斗足球》。它当年的联机依赖快牙 SDK，创建房间时还能看到熟悉的热点名前缀：

```text
*#FFB# FightFootball
```

问题是，游戏本身太老，旧快牙 SDK 在现在的 Android、模拟器和真机环境里已经不能可靠工作。最开始的表现是：

1. 一台设备可以创建房间。
2. 另一台设备点击加入后一直转圈。
3. 房主端看不到稳定的加入请求。
4. 后续即使强行推进到选人界面，也可能 ready 后崩溃，或者房主端卡死。

除了联机，APK 还有现代设备兼容问题：不是全屏，启动时还会提示 SDK 版本过低。不过这篇主要记录联机修复的排错过程。

## 最初现象

创建房间这一步仍然能触发原游戏 UI：

![房间创建成功](https://fastly.jsdelivr.net/gh/KingPenguinMan/image-bed/img/football-lan-fix/host-room-created.png)

另一台设备能看到房间后，点击加入：

![客户端发现房间](https://fastly.jsdelivr.net/gh/KingPenguinMan/image-bed/img/football-lan-fix/client-room-found.png)

早期大部分尝试都会卡在这个 loading：

![加入中卡住](https://fastly.jsdelivr.net/gh/KingPenguinMan/image-bed/img/football-lan-fix/client-joining.png)

这个现象很容易误判成三个方向：

1. 两台设备不在同一局域网。
2. UDP 广播发现失败。
3. 房主端 TCP 端口没有打开。

这些方向都查过，但后来证明它们只解释了一部分现象。真正的问题分成两层：

1. Java 层的快牙 SDK 房间发现和加入流程确实失效。
2. native 层的比赛同步逻辑仍然可用，但非常依赖 Java 层传进去的玩家 IP、玩家顺序和身份信息。

也就是说，不能只让房间列表里出现一个按钮。必须让原游戏 native 层认为“这是一个合法的两人房间”。

## 为什么没有从零重写

中途也尝试过用 Godot 重新做一个优化版。理论上，美术资源、UI 图片、音效、部分配置都能从 APK 解包出来，但这并不等于能直接得到一个可运行的工程。

主要困难有几个：

1. APK 里的资源不是 Godot 工程资源。
2. 碰撞、动作、技能、角色状态机大量固化在 native 二进制里。
3. 球物理、射门判定、进球判定、AI 和镜头都要重新实现。
4. 即使素材完全复用，手感仍然要重新调。
5. 联机同步如果重写，状态同步、延迟处理和结算一致性也都要重新设计。

所以最后判断：如果目标是“让老游戏能继续玩”，修原 APK 比重写更现实。

## 总体策略

最终策略是：

```text
保留：原游戏 native 比赛同步逻辑
替换：旧快牙 SDK 的房间发现、加入、玩家列表
补齐：现代 Android SDK 提示和全屏显示
```

这次没有重写比赛逻辑，也没有修改 `libcocos2dcpp.so` 里的核心同步协议。真正动的是 Java/smali 层，让它重新向 native 层提供正确的玩家信息。

整体链路是：

```text
房主点击创建房间
  -> 自建 LanGameCenter 启动 lobby 服务
  -> 客户端搜索房间
  -> 客户端通过 TCP 请求加入
  -> 房主保存客户端名称、IP、状态
  -> ZapyaGameCenter.getAllUsers() 返回伪造玩家列表
  -> native ZapyaJNI::Init 读取玩家信息
  -> 原 SocketClient / SocketServer 继续同步比赛
```

这条路线的关键是：快牙 SDK 可以替换，但 native 看到的数据结构要尽量保持原样。

## 第一步：确认 APK 结构

先用 `apktool` 和 `jadx` 分别看 smali 和 Java 结构。比较关键的类包括：

```text
com.ZapyaGame.Activity.GameActivity
com.ZapyaGame.Activity.ZapyaGameCenter
com.ZapyaGame.Activity.PlayerInfo
com.ZapyaGame.Activity.LanGameCenter
```

原游戏 native 层会通过 `ZapyaGameCenter` 取得玩家列表，再把玩家 IP、名字、ID 传给 C++ 层。

这里有一个重要结论：  
房间列表 UI 能显示，不代表 native 层已经拿到了正确玩家列表。选人界面能打开，也不代表比赛同步已经稳定。

## 第二步：替换房间发现

旧快牙 SDK 的发现流程已经不可用，所以重构了一个本地 `LanGameCenter`。

它做几件事：

1. 创建房间时启动 TCP lobby 服务。
2. 搜索时生成房间列表。
3. 加入时向房主发送加入请求。
4. 房主收到请求后保存客户端。
5. 双方进入选人前，生成原游戏需要的玩家列表。

测试模拟器时，为了绕开模拟器广播和互联不稳定的问题，还加入了一个 ADB 测试房间：

```text
*#FFB# ADB|127.0.0.1|9876
```

配套的 ADB 桥接是：

```powershell
adb -s emulator-5554 forward tcp:19876 tcp:9876
adb -s emulator-5556 reverse tcp:9876 tcp:19876
```

这里 `9876` 是自建 lobby 端口。这个阶段解决的是“点加入能不能通知房主”。

## 第三步：加入成功但仍然崩溃

早期修完 lobby 后，现象变成了：

1. 房主能进入选人界面。
2. 加入端仍然转圈，或者稍后进入选人界面。
3. 双方 ready 后，加入端崩溃，房主端卡死。

这说明 Java 层 lobby 已经往前推进了，但 native 层比赛通信仍然不对。

抓日志时看到过这些关键行：

```text
ZapyaJNI::Init
clients num 2
SocketClient::CreateTCPSend
client Send msg: 9 to ip: 127.0.0.1
GameReceive msg 9
heartBeatResponse
```

以及 native crash：

```text
FORTIFY: pthread_mutex_lock called on a destroyed mutex
SocketClient::CreateTCPSocket
SocketServer::CreateTCPAccept
```

单看 `pthread_mutex_lock called on a destroyed mutex`，很容易以为是线程生命周期 bug。但结合前后的网络日志，实际更像是错误连接状态引发了 native 内部资源释放顺序问题。

## 第四步：找 native 真正需要什么

继续看日志后发现，native 层会自己开 TCP 连接并发心跳：

```text
send HeartBeatRequest
heartBeatRequest
client Send msg: 9
GameReceive msg 9
heartBeatResponse
```

`msg 9` 基本可以理解为心跳类消息。ready 时还会出现：

```text
readyok
client Send msg: 2
GameReceive msg 2
sPlayerReadyState1
sPlayerReadyState2
```

也就是说，选人界面之后已经不是快牙 SDK 在同步了，而是原游戏 native 的 `SocketClient` / `SocketServer` 在工作。

这一步排查出了两个关键事实：

1. 原 native 比赛同步没有完全坏。
2. 它需要 Java 层传入正确的玩家 IP 和玩家顺序。

如果 Java 层传错，native 会向错误地址发心跳，最终表现成转圈、卡死或崩溃。

## 第五步：纠正玩家列表

核心修改点在 `ZapyaGameCenter.getAllUsers()` 附近。

原 native 层期待拿到类似快牙 SDK 的 `DmUserHandle` 列表。修复时没有去改 native，而是在 Java/smali 层伪造这个列表：

```text
房主侧：
  本机是 HOST / ME
  加入者是 CLIENT / OTHER

加入侧：
  房主是 HOST / OTHER
  本机是 CLIENT / ME
```

同时 `LanGameCenter.getPlayers()` 需要返回 `PlayerInfo`：

```text
playerID
playerName
playerIP
```

这里的 `playerIP` 很关键。它不是 UI 展示字段，而是 native 后续建 TCP 连接的依据。

曾经有一个中间版本里，房主端日志出现过：

```text
client Send msg: 9 to ip: 172.16.1.6
```

而 `172.16.1.6` 正是房主自己的 IP。这意味着房主把自己当成了对端。客户端侧也出现过向 `127.0.0.1` 发包的情况。

这些日志说明：  
问题不是“native 不会同步”，而是“native 被喂了错误的对端信息”。

## 第六步：模拟器环境的坑

这次测试用的是两台雷电模拟器。它们看起来在同一网段：

```text
emulator-5554: 172.16.1.6
emulator-5556: 172.16.1.5
gateway:       172.16.1.1
```

但实际测试时，模拟器之间的直连并不可靠。尤其是 ADB bridge 会制造一个很容易误导判断的环境：

```powershell
adb forward
adb reverse
```

`adb reverse tcp:33221 tcp:33221` 一度让客户端能收到 host 的 native 心跳，但它也会占用客户端本地的 `33221` 端口，导致客户端自己的 native server 行为被改变。

所以这里的排错原则是：

1. lobby 阶段可以用 ADB bridge 先打通。
2. native 比赛阶段要确认双方实际连接的 IP 和端口。
3. 不能只看“收到了心跳”，还要看是不是连到了正确的对端。
4. 模拟器通过了，不代表真实手机所有网络环境都通过。

## 第七步：最终可用版本

最终可用版本里，流程变成：

1. 房主创建房间。
2. 客户端搜索到房间。
3. 客户端发起加入。
4. 房主收到加入，并触发双方进入选人。
5. `getAllUsers()` 返回正确的两人列表。
6. native 初始化时读取到正确玩家。
7. 双方 ready 后进入比赛。
8. 原 native 同步逻辑负责比赛过程。

双方进入后续流程：

![房主端进入后续流程](https://fastly.jsdelivr.net/gh/KingPenguinMan/image-bed/img/football-lan-fix/host-after-join.png)

![加入端进入后续流程](https://fastly.jsdelivr.net/gh/KingPenguinMan/image-bed/img/football-lan-fix/client-after-join.png)

最终测试结果：

```text
房主创建房间：正常
客户端搜索房间：正常
客户端加入：正常
双方进入选人：正常
双方 ready：正常
进入比赛：正常
移动同步：正常
进球判定：正常
比分同步：正常
结算：正常
完整一局：未崩溃
```

## 排错时间线

这次排错不是一次成功，而是逐层把问题剥开。

第一阶段只关注“能不能看到房间”。  
这一步最容易被 UI 欺骗。列表里能出现房间，并不代表加入链路通了。早期甚至出现过“不创建房间也能搜到一个 ADB 房间”的情况，这是因为测试入口为了方便调试写死了一个伪房间。它对验证 UI 有用，但不能证明真实 lobby 已经正常。

第二阶段关注“房主能不能收到加入请求”。  
这时引入了自建 TCP lobby。客户端点击加入后，不再依赖旧快牙 SDK，而是直接向房主发送加入消息。这个阶段解决后，房主端开始能进入后续流程。

第三阶段关注“客户端为什么还在转圈”。  
日志显示客户端其实已经收到过加入完成信号，但 UI 和 native 初始化的状态没有完全同步。这里补了更早的 join OK 回调，让客户端不要一直卡在 loading。

第四阶段关注“为什么都进选人了还崩溃”。  
这一步才真正接近核心。选人界面出现后，快牙 SDK 的作用已经很小，native 比赛同步开始接管。崩溃点在 native socket 附近，但根因仍然是 Java 层传入的玩家列表不正确。

第五阶段关注“ready 消息是否同步”。  
这一阶段看到双方都能收到心跳 `msg 9`，也能收到 ready 相关的 `msg 2`。这说明原游戏的同步协议没有死，剩下的问题是连接对象和玩家身份是否稳定。

第六阶段完整打一局。  
只有完整完成移动、进球、比分、结算，才能说明修复不是只把 UI 推过去了，而是真正把比赛同步跑通了。

## 具体修改方案

修改方案可以拆成几个明确的点。

### 1. Manifest 和全屏

老 APK 在新系统上会提示 SDK 版本过低，同时显示区域不能铺满屏幕。这里主要改：

```text
AndroidManifest.xml
GameActivity.smali
```

目标是让系统不再用过时兼容模式运行它，并在 Activity 启动时进入横屏全屏/沉浸式显示。

### 2. 用 LanGameCenter 替代旧 SDK 外围

旧快牙 SDK 原本负责：

```text
创建热点/房间
广播房间
发现房间
加入房间
维护成员列表
```

修复后，这部分改成 `LanGameCenter` 自己维护：

```text
createRoom()
scanRooms()
joinRoom()
acceptClient()
getPlayers()
```

lobby 层只做一件事：把双方带到原游戏 native 能继续工作的状态。

### 3. 伪造 DmUserHandle

native 层不认识新的 `LanGameCenter`，它仍然通过原来的 `ZapyaGameCenter.getAllUsers()` 取人。所以这里不能简单返回自定义对象，必须返回原来 SDK 形式的 `DmUserHandle`。

逻辑上等价于：

```text
if host:
    return [me_as_host, remote_as_client]

if client:
    return [host_as_host, me_as_client]
```

重点不是名字，而是：

```text
MEMBER_TYPE
MEMBER_ROLE
playerIP
playerID
```

这些字段会影响 native 判断谁是房主、谁是客户端、应该连哪个 IP。

### 4. 保留 native 比赛通信

没有去重写这些逻辑：

```text
SocketClient::CreateTCPSend
SocketServer::CreateTCPAccept
GameReceive
HeartBeatRequest
HeartBeatResponse
ready state
score result
```

因为日志已经证明它能工作。修复重点是让它拿到正确输入，而不是替换它。

### 5. 模拟器桥接只作为测试手段

在雷电模拟器里测试时，用过：

```powershell
adb -s emulator-5554 forward tcp:19876 tcp:9876
adb -s emulator-5556 reverse tcp:9876 tcp:19876
```

这只解决 lobby 测试，不应该被理解成最终真实手机方案。真实手机测试时，最好还是让两台手机处在同一路由器或同一热点下，再验证 UDP/TCP 能否直连。

### 6. 打包验证

每次 smali 修改后，都按这个流程构建：

```powershell
apktool b .\apktool-v2 -o .\football-lan-v12-unsigned.apk
jarsigner -keystore .\debug-lan.keystore `
  -storepass android `
  -keypass android `
  .\football-lan-v12.apk androiddebugkey
```

然后安装到两台设备：

```powershell
adb -s emulator-5554 install -r .\football-lan-v12.apk
adb -s emulator-5556 install -r .\football-lan-v12.apk
```

测试时不只看能不能进房间，而是按固定清单检查：

```text
创建房间
搜索房间
点击加入
双方进入选人
双方 ready
进入比赛
移动同步
射门/进球判定
比分同步
结算
退出后再次创建
```

## 兼容性修改

除了联机本身，还做了两个现代 Android 兼容修补。

第一是 Manifest 里的 SDK 配置，避免启动时一直提示 SDK 版本过低。

第二是 Activity 全屏/沉浸式显示，解决老游戏在新屏幕上不是全屏的问题。

这些修改不影响网络协议，但能让游戏在现在的设备上更像一个正常应用。

## 这次修复到底改了什么

可以把修改分成三类。

第一类是兼容修复：

```text
AndroidManifest.xml
GameActivity.smali
```

用于处理 SDK 版本提示和全屏显示。

第二类是联机外围替换：

```text
LanGameCenter
ZapyaGameCenter
```

用于替代旧快牙 SDK 的房间发现、创建、加入和玩家管理。

第三类是调试辅助：

```text
ADB 测试房间
logcat 日志
端口转发
模拟器桥接
```

用于确认问题到底出在 lobby 阶段还是 native 比赛阶段。

真正没有改的是：

```text
libcocos2dcpp.so 里的比赛同步协议
角色移动、碰撞、射门、进球、结算逻辑
```

这也是为什么最后能保留原游戏手感。

## 复盘：几个关键误区

第一个误区：看到加入转圈，就以为只是房间发现失败。  
实际上房间发现只是第一层，后面还有玩家列表和 native 初始化。

第二个误区：看到 native 崩溃，就以为必须改 so。  
这次崩溃更像是 Java 层传错数据后，native 进入错误连接状态造成的连锁反应。

第三个误区：看到两台模拟器 IP 在同一网段，就以为它们一定能互通。  
模拟器网络、ADB forward、ADB reverse 都会改变真实连接路径。

第四个误区：重新做一个现代版本会更简单。  
对这种老游戏来说，素材可提取不等于玩法可复用。原生逻辑还能跑时，修外围往往更划算。

## 后续可以继续做什么

当前版本已经能完成一局联机，但还可以继续整理：

1. 把 ADB 测试房间和真实手机局域网逻辑分开。
2. 给真实手机增加更可靠的 UDP 广播或手动 IP 加入。
3. 清理旧快牙 SDK 残留。
4. 把 smali 修改整理成可重复构建脚本。
5. 给 APK 打一个明确的修复版版本号。
6. 在更多真机网络环境下测试，例如同路由器、手机热点、AP 隔离网络。

## 总结

这次修复最重要的结论是：

```text
坏掉的是旧快牙 SDK 外围联机服务，
不是原游戏的比赛同步核心。
```

只要重新实现创建房间、搜索房间、加入房间和玩家列表，把 native 层需要的玩家信息喂对，十年前的《格斗足球》仍然可以完成局域网联机。

最后的结果很简单：两台设备能创建、加入、选人、ready、比赛、进球、结算。对一个已经没人维护的老游戏来说，这比重写一个“看起来像”的版本更接近真正的修复。
