---
title: Common Network Commands
date: 2026-04-08 16:05:55
index_img:
banner_img:
tags:
  - kali
categories:
  - kali
excerpt: 简单的网络命令
---

### 1. 查看本机网络信息
```shell
ip -a    #新方法
ifconfig #旧方法
```

### 2.无线连接
```shell
iwconfig
```

### 3. 地址解析协议ARP
```shell
ip n
arp -a
```

### 4.路由表
```shell
ip -r
```

### 5.检测机器在线
```shell
ping
```

## Starting and Stopping Service
```shell
sudo service apache2 start / stop

python3 -m http.server 80

sudo systemctl disable / enable ssh #start a service when startup
```