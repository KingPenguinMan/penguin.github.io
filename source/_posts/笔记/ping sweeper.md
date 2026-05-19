---
title: ping sweeper
date: 2026-04-08 16:06:10
index_img:
banner_img:
tags:
  - kali
categories:
  - kali
excerpt: 简单ip扫描器
---

```shell
┌──(penguin㉿kali)-[~/Documents]
└─$ cat ip.txt | grep "64 bytes"

64 bytes from 192.168.227.1: icmp_seq=1 ttl=128 time=0.327 ms
  
┌──(penguin㉿kali)-[~/Documents]
└─$ cat ip.txt | grep "64 bytes"| cut -d " " -f 4 | tr -d ":" 
192.168.227.1

```

ipsweep.sh
```bash
#!/bin/bash    声明bash脚本

if [ "$1" == "" ]
then
echo "Forget an IP Address"
echo "Syntax ./ipsweep.sh 192.168.227"

else
for ip in `seq 1 254` ; do
ping -c 1 $1.$ip | grep "64 bytes"| cut -d " " -f 4 | tr -d ":" &
done
fi
```

```
运行 ./ipsweep.sh 192.168.227
```

自动化
```bash
 ./ipsweep.sh 192.168.227 >ips.txt

for ip in (cat ips.txt) ; do nmap $ip ; done  
```