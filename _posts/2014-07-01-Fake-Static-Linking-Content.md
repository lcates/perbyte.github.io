---
layout:      post
date:        2014-07-01
title:       "Static Linking for .NET, sort of"
meta:        "Dirty is as dirty does"
description: "A method for embedding an external library when you don't control the host, what you're running with, or much of anything"
comments:    true
author:      josh
categories:  
tags:        .net hack
---

**What do you do when you need to reference a third-party library? That's easy, right?**

*Install-Package Save.Me.A.Butt.Load.Of.Time*

**Would I have asked if it was that easy? How about when you're working in an application that allows for plug-ins or modules that aren't sandboxed or in any way isolated? (i.e. certain CMSs, ERPs, SAPs, WTFs)**

*Same answer right?*

**Not if you're worried about conflicting versions of those third party libraries. Between code signing, breaking changes, and modules that are never updated you're signing up for some annoyances at best.**

*Ok, so let's throw this into the GAC. It allows side-by-side.*

**True, but many third-party libraries never update the important part of their version so as to avoid other versioning issues. So the older version and the newer version actually are the same version. Makes sense, right?**

*Use [ILMerge][ilmerge].*

**I forgot to mention that this system I'm working in often runs as an ASP.NET website which means a lot of dynamic compilation. Namespaces are critical, unique ones are good. Now we have duplicates and many existing pages that I can't control will likely break.**

*I got it. You can try to [embed the assembly][richter].*

**Good idea except for that you need to have control over the host and neither the web site nor the actual main application allow for that.**

*Ask the host to use MEF for the plugins.*

**I'm still waiting for them to fix a one line code issue that I provided for them from over a year ago. I need this now.**

*Why are you working in this... challenging system?*

**That's not helpful. I like having a job.**

*Well, this third-party library is open source, right? Embed the code into your project.*

**Not bad. Then I could just change the namespace on the hundreds of files and repeat that process everytime I need to get an updated version of that library. That sounds fun.**

*Aren't you a programmer?*

**Right. [On it][code].**

[code]: https://github.com/joshucar/stemcells/blob/master/embedder/
[ilmerge]: http://research.microsoft.com/en-us/people/mbarnett/ILMerge.aspx
[richter]: http://blogs.msdn.com/b/microsoft_press/archive/2010/02/03/jeffrey-richter-excerpt-2-from-clr-via-c-third-edition.aspx?PageIndex=5
