---
title: 修复十年前快牙游戏《格斗足球》的局域网联机
date: 2026-07-09 21:20:00
index_img: /img/football-lan-fix/host-room-created.png
banner_img: /img/football-lan-fix/host-room-created.png
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

这次修的是一个很老的 Android 游戏：《格斗足球》。它原本依赖快牙的联机能力，房间名前缀还是熟悉的：

```text
*#FFB# FightFootball
```

问题是，游戏本身已经十年左右没有维护。旧快牙 SDK 在现在的 Android 环境里基本不可用，导致内置联机功能完全失效。

最开始的现象很简单：

1. 一台设备可以创建房间。
2. 另一台设备点击加入后一直转圈。
3. 房主端看不到有效请求。
4. 后续即使强行推进到选人界面，也可能 ready 后崩溃或者房主卡死。

除了联机问题，游戏还有两个现代设备兼容问题：不是全屏，以及进入游戏时提示 SDK 版本过低。不过这篇主要记录联机修复。

## 最初的现象

创建房间仍然能触发原游戏 UI：

![房间创建成功](/img/football-lan-fix/host-room-created.png)

另一台设备能够看到房间列表后，点击加入：

![客户端发现房间](/img/football-lan-fix/client-room-found.png)

早期大部分尝试都会卡在这里：

![加入中卡住](/img/football-lan-fix/client-joining.png)

这类问题很容易被误判成“广播发现失败”或者“两个模拟器不在同一个局域网”。但后面的日志证明，真正的问题分了两层：

1. Java 层的快牙 SDK 房间发现、加入流程已经失效。
2. native 层的比赛同步逻辑还在，但依赖 Java 层传进去的玩家 IP、玩家顺序和连接状态。

也就是说，不能只解决“列表里能显示房间”，还要让 native 层拿到正确的玩家信息。

## 为什么没有从零重写

中途也试过用 Godot 重新做一个优化版。理论上可以复用原游戏的美术和玩法，但实际工作量很快暴露出来：

- 原 APK 里的资源可以提取，但碰撞、动画、技能、角色状态机并不是现成的可导入项目。
- native 二进制里确实有大量逻辑，但它们不是 Godot 可直接读取的“配置参数”。
- 玩法复刻需要重新实现角色移动、攻击、射门、球物理、判定、AI、UI 流程和网络同步。
- 就算美术完全复用，核心手感仍然要重新调。

最后判断：如果目标是“让老游戏能继续玩”，直接修原 APK 的收益远大于重写。

## 修复思路

最终方案是：

```text
保留：原游戏 native 比赛同步逻辑
替换：旧快牙 SDK 的房间发现、加入、玩家列表
补齐：现代 Android 兼容和全屏显示
```

整体链路可以概括成这样：

```text
创建房间设备
  |
  |  自建 TCP lobby，监听加入请求
  v
LanGameCenter
  |
  |  伪造/维护玩家列表
  v
ZapyaGameCenter.getAllUsers()
  |
  |  返回原 native 层期待的 DmUserHandle
  v
原游戏 libcocos2dcpp.so
  |
  |  继续使用原 SocketClient / SocketServer 同步比赛
  v
移动、ready、进球、结算
```

关键点是：不要动 native 战斗同步协议。它虽然老，但还可以工作。真正坏掉的是外围的 SDK 服务。

## 替换快牙 SDK 外围逻辑

原游戏通过 `ZapyaGameCenter` 和快牙 SDK 通信，native 层会从这里拿玩家列表。

修复时新增了一个本地 `LanGameCenter`，负责：

- 创建房间时启动 lobby 服务。
- 搜索时返回可加入房间。
- 加入时通过 TCP 给房主发送请求。
- 房主记录加入者的名称和 IP。
- 双方进入选人界面前，让 `getAllUsers()` 返回正确的玩家列表。

客户端加入后，双方都能进入选人界面：

![房主端进入后续流程](/img/football-lan-fix/host-after-join.png)

![加入端进入后续流程](/img/football-lan-fix/client-after-join.png)

这里最重要的并不是 UI 变化，而是 native 初始化时拿到的玩家结构终于正确了。

## native 崩溃的真正原因

调试过程中出现过一个很有代表性的 native 崩溃：

```text
FORTIFY: pthread_mutex_lock called on a destroyed mutex
SocketClient::CreateTCPSocket
SocketServer::CreateTCPAccept
```

一开始看起来像线程锁被提前释放，但结合网络日志后发现，它更像是错误连接状态造成的后果。

关键日志类似这样：

```text
ZapyaJNI::Init
clients num 2
SocketClient::CreateTCPSend
client Send msg: 9 to ip: 127.0.0.1
GameReceive msg 9
heartBeatResponse
```

以及房主端曾经出现过：

```text
client Send msg: 9 to ip: 172.16.1.6
```

其中 `172.16.1.6` 是房主自己的 IP。也就是说，在某些中间版本里，房主把自己当成了对端，客户端又在向 `127.0.0.1` 发包。表面上是 native crash，根因仍然是 Java 层传给 native 的玩家 IP 和身份关系不正确。

这也是这次修复最核心的经验：  
老游戏 native 层不一定坏了，但它对外围 SDK 返回的数据格式非常敏感。

## 模拟器测试时的额外问题

这次主要用两台雷电模拟器做测试。模拟器之间看起来在同一网段，但实际互通并不稳定，尤其是直接互连、广播发现和端口转发都容易误导判断。

测试过程中用过 ADB bridge：

```powershell
adb -s emulator-5554 forward tcp:19876 tcp:9876
adb -s emulator-5556 reverse tcp:9876 tcp:19876
```

其中 `9876` 是重构后的 lobby 端口。

后续 native 比赛同步还会打开自己的 TCP 连接。这里调试时要特别小心：`adb reverse` 会占用客户端本地端口，可能改变游戏自己开 server socket 的行为。因此模拟器环境的结论不能直接等同于真实手机环境。

最终可用版本在两台模拟器上完成了完整一局测试：

- 房主创建房间正常。
- 客户端搜索并加入正常。
- 双方进入选人界面。
- 双方 ready 后进入比赛。
- 移动、进球、比分同步正常。
- 结算正常。
- 完整一局未崩溃。

## 兼容性修补

除了联机，APK 还做了基础兼容修补：

- 调整 Manifest 里的 SDK 配置，避免启动时提示 SDK 版本过低。
- 给 Activity 补全屏/沉浸式显示逻辑。
- 保留原游戏横屏 UI 和资源，不重做美术。

这些修改不影响联机协议，但能让游戏在现在的模拟器和手机上更像一个正常应用。

## 这次修复的边界

当前版本已经能在测试环境完成一局联机，但它仍然不是一个彻底现代化的联机系统。

它解决的是：

- 旧 SDK 不可用。
- 房间发现和加入流程失效。
- Java 层玩家信息无法正确传给 native。
- 新系统上的基础显示和 SDK 提示问题。

它还没有彻底解决：

- 不同品牌真机之间的局域网发现兼容性。
- 复杂网络环境下的 NAT、热点、AP 隔离。
- 原 native 网络代码本身的线程安全隐患。
- 彻底去除旧快牙 SDK 的所有残留。

所以这个版本更适合作为“可玩基线”：先让游戏恢复联机，再逐步整理成更干净的开源版本。

## 复盘

这类老 APK 修复最容易踩的坑，是一上来就想把所有东西重写。实际看下来，最有价值的路线是先判断哪些东西还能用。

这次能修通，关键在于把系统拆成两层：

```text
坏掉的部分：旧快牙 SDK 的外围服务
仍可使用：原游戏 native 比赛同步逻辑
```

只要把外围服务替换掉，并把 native 层需要的数据喂对，十年前的游戏逻辑仍然可以继续跑。

最后的结果很朴素：两台设备能创建、加入、选人、ready、比赛、进球、结算。对一个已经没人维护的老游戏来说，这比从零重写一个“看起来相似”的版本更接近真正的修复。
