---
title: Linux基本语法
date: 2026-03-27 17:14:27
index_img:
banner_img:
tags:
  - linux
categories:
  - linux
excerpt: linux的基础命令
---
# 常用文件管理命令
```shell
(1) ctrl c: 取消命令，并且换行
(2) ctrl u: 清空本行命令
(3) tab键：可以补全命令和文件名，如果补全不了快速按两下tab键，可以显示备选选项
(4) ls: 列出当前目录下所有文件，蓝色的是文件夹，白色的是普通文件，绿色的是可执行文件
(5) pwd: 显示当前路径
(6) cd XXX: 进入XXX目录下, cd .. 返回上层目录
(7) cp XXX YYY: 将XXX文件复制成YYY，XXX和YYY可以是一个路径，比如../dir_c/a.txt，表示上层目录下的dir_c文件夹下的文件a.txt
(8) mkdir XXX: 创建目录XXX
(9) rm XXX: 删除普通文件;  rm XXX -r: 删除文件夹
(10) mv XXX YYY: 将XXX文件移动到YYY，和cp命令一样，XXX和YYY可以是一个路径；重命名也是用这个命令
(11) touch XXX: 创建一个文件
(12) cat XXX: 展示文件XXX中的内容
(13) 复制文本 windows/Linux下：Ctrl + insert，Mac下：command + c
(14) 粘贴文本windows/Linux下：Shift + insert，Mac下：command + v
```
# 文件权限概念
![image.png](https://fastly.jsdelivr.net/gh/KingPenguinMan/image-bed/img/20260328103056528.png)
![image.png](https://www.runoob.com/wp-content/uploads/2014/06/363003_1227493859FdXT.png)
[0]文件类型
- [d]目录 -文件
- [l]链接文件（link file)
- [b]可随机存取设备
- [c]一次性读取设备

接下来的字符三个一组 “rwx”三个字符组合
- [r]read
- [w]write
- [x]execute
- [-]无权限

|**权限组合**|**数字简写**|**常见用途**|
|---|---|---|
|`rwx------`|**700**|只有你能看的私密文件|
|`rw-r--r--`|**644**|常见的网页/博客文件权限|
|`rwxr-xr-x`|**755**|脚本或程序的标准执行权限|

第一组 “文件拥有者可具备的权限”
第二组 “加入此群组之账号的权限”
第三组 “非本人且没有加入本群组之其他账号的权限”

第二栏 表示有多少文件名链接到此节点（i-node）
第三栏 表示这个文件（目录）的“拥有者账号”
第四栏 表示这个文件的所属群组
第五栏 表示大小（Bytes）
第六栏 为创建日期或修改日期（距离太久就只显示年份）
第七栏 这个文件文件名

## 更改文件属性

### 1、chgrp：更改文件属组
### changegroup

语法：

chgrp [-R] 属组名 文件名

参数选项

- -R：递归更改文件属组，就是在更改某个目录文件的属组时，如果加上 -R 的参数，那么该目录下的所有文件的属组都会更改。

 组名必须在/etc/group 存在，否则会报错
 
### 2、chown：更改文件所有者（owner），也可以同时更改文件所属组。changeowner

语法：

chown [–R] 所有者 文件名
chown [-R] 所有者:属组名 文件名

进入 /root 目录（~）将install.log的拥有者改为bin这个账号：
```shell
[root@www ~] cd ~
[root@www ~]# chown bin install.log
[root@www ~]# ls -l
-rw-r--r--  1 bin  users 68495 Jun 25 08:53 install.log
```

将install.log的拥有者与群组改回为root：
```shell
[root@www ~]# chown root:root install.log
[root@www ~]# ls -l
-rw-r--r--  1 root root 68495 Jun 25 08:53 install.log
```

### 3、chmod：更改文件9个属性

Linux文件属性有两种设置方法，一种是数字，一种是符号。

Linux 文件的基本权限就有九个，分别是 **owner/group/others(拥有者/组/其他)** 三种身份各有自己的 **read/write/execute** 权限。

先复习一下刚刚上面提到的数据：文件的权限字符为： -rwxrwxrwx ， 这九个权限是三个三个一组的！其中，我们可以使用数字来代表各个权限，各权限的分数对照表如下：

- r:4
- w:2
- x:1

每种身份(owner/group/others)各自的三个权限(r/w/x)分数是需要累加的，例如当权限为： -rwxrwx--- 分数则是：

- owner = rwx = 4+2+1 = 7
- group = rwx = 4+2+1 = 7
- others= --- = 0+0+0 = 0

所以等一下我们设定权限的变更时，该文件的权限数字就是 **770**。变更权限的指令 chmod 的语法是这样的：

 chmod [-R] xyz 文件或目录

选项与参数：

- **xyz** : 就是刚刚提到的数字类型的权限属性，为 **rwx** 属性数值的相加。
- **-R** : 进行递归(recursive)的持续变更，以及连同次目录下的所有文件都会变更

举例来说，如果要将 **.bashrc** 这个文件所有的权限都设定启用，那么命令如下：
```shell
[root@www ~]# ls -al .bashrc
-rw-r--r--  1 root root 395 Jul  4 11:45 .bashrc
[root@www ~]# chmod 777 .bashrc
[root@www ~]# ls -al .bashrc
-rwxrwxrwx  1 root root 395 Jul  4 11:45 .bashrc
```
那如果要将权限变成 _-rwxr-xr--_ 呢？那么权限的分数就成为 [4+2+1][4+0+1][4+0+0]=754。

### 符号类型改变文件权限

还有一个改变权限的方法，从之前的介绍中我们可以发现，基本上就九个权限分别是：

- user：用户
- group：组
- others：其他

那么我们就可以使用 **u, g, o** 来代表三种身份的权限。

此外， **a** 则代表 **all**，即全部的身份。读写的权限可以写成 r, w, x，也就是可以使用下表的方式来看：

| chmod | u  go  a | +(加入)  -(除去)  =(设定) | r  w  x | 文件或目录 |
| ----- | -------- | ------------------- | ------- | ----- |

如果我们需要将文件权限设置为 **-rwxr-xr--** ，可以使用 chmod u=rwx,g=rx,o=r 文件名 来设定:
```shell
#  touch test1    // 创建 test1 文件
# ls -al test1    // 查看 test1 默认权限
-rw-r--r-- 1 root root 0 Nov 15 10:32 test1
# chmod u=rwx,g=rx,o=r  test1    // 修改 test1 权限
# ls -al test1
-rwxr-xr-- 1 root root 0 Nov 15 10:32 test1
```
而如果是要将权限去掉而不改变其他已存在的权限呢？例如要拿掉全部人的可执行权限，则：
```shell
# chmod  a-x test1
# ls -al test1
-rw-r--r-- 1 root root 0 Nov 15 10:32 test1
```