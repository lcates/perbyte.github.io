---
layout:      post
date:        2014-07-07
title:       "Redirecting Console Output"
meta:        ""
description: ""
comments:    true
author:      jason
categories:  
tags:        
---

This should be easier. .NET provides some great ways to launch a console application and capture it's output, but I kept finding bad example after bad example and ended up running around like a chicken with my head cut off. Hence, this post.

To clarify what I mean by "redirecting console output", most of us have seen a typical console window:

![Console Window](/public/image/console-window.png)

This is what it usually looks like when you run a console application in Windows. However, while working on a [side project of mine][labo], I needed a way to integrate [CDRDAO][cdrdao] into my application. CDRDAO is an open-source console application that burns and rips CDs; I wanted to integrate it without popping up the ugly black console window, and I also needed to be able to read its output within my application. I wanted it to look something like this:

![LaunchBox](/public/image/launchbox.png)

Easy, I thought. Well, sort of, but not exactly straightforward without some research.

[labo]: http://www.launchbox-app.com/
[cdrdao]: http://cdrdao.sourceforge.net/