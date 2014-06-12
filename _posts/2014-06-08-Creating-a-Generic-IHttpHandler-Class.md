---
layout:     post
date:       2014-06-08
title:      "Creating a Generic IHttpHandler Class for Use with Aptify"
meta:       ""
description: ""
comments:   true
author:     jason
categories:
tags:       aptify asp.net
---

Hi, my name is [Jason Carr][jason], and I'll be the other half of this incredible blog. I'll save the world from a long and boring introduction.

So let's talk generic handlers. Aptify does have some base HTTP handlers, but they're more than a bit pigeonholed and rather awkward to use. Let's create a proper base HTTP handler class that gives us full access to Aptify with ease.

tl;dr
-----

If you're like me and just want the code, you can easily view the entire base class code [right here][code].

What is an ASP.NET generic handler?
-----------------------------------

In ASP.NET, generic handlers are typically used in situations where standard web page functionality doesn't fully apply. For example, they can be used similarly to a web service to send and receive XML or JSON data. Or, they can always be used in the ways Aptify originally intended: to dynamically size and process images or file downloads.

Generic handlers are extremely flexible and can be used in pretty much any situation that lives outside of the bounds of a typical ASP.NET web page.

Diving In
---------

Let's start with what's required for the most basic implementation of a generic handler:

```C#
using System;
using System.Web;

public class HttpHandlerBase : IHttpHandler
{
    /// <summary>
    /// Gets a value indicating whether this instance can be reused between successive requests.
    /// </summary>
    public virtual bool IsReusable
    {
        get { return true; }
    }

    /// <summary>
    /// Process the incoming HTTP request.
    /// </summary>
    /// <param name="context">The <see cref="HttpContext"/> for the request.</param>
    public void ProcessRequest(HttpContext context)
    {
        context.Response.ContentType = "text/plain";
        context.Response.Write("Hello World");
    }
}
```

Here we're simply dumping `Hello World` as text. The `ProcessRequest` method is the entry point for a request. We set the returned content type to `text/plain` and write `Hello World` to the response output. Navigating to the URL of this handler would simply show `Hello World` in clear text in your browser.

The `IsReusable` property specifies whether or not an existing instance of the class can be re-used for another request. We're returning `true` for performance benefits as this avoids the need for a new instance of our handler being created for every request. If you need to store local state or don't want to concern yourself with concurrency issues feel free to override and return `false`.

Allowing for Easy Implementations
---------------------------------

Obviously the goal for our base class is to provide base functionality and make it easy to extend the class. Let's add in some code to help out:

```C#
/// <summary>
/// Gets the MIME type of the response for this request.
/// </summary>
protected virtual string ContentMimeType
{
    get { return "text/html"; }
}
```

We'll use this later, but this allows child classes to specify the type of data that is returned from the handler. For example, if a PNG image is returned, this could be overridden to return `image/png`. Mime types are simply a way of specifying what type of data is returned; possible values can be easily [looked up on the web][iana].

```C#
/// <summary>
/// Processes the incoming HTTP request.
/// </summary>
/// <param name="context">The <see cref="HttpContext"/> for the request.</param>
protected abstract void ProcessRequestCore(HttpContext context);

/// <summary>
/// Validates the incoming parameters.  Defaults to <b>true</b>.
/// </summary>
/// <param name="context">The <see cref="HttpContext"/> for the request.</param>
/// <returns><b>True</b> if not implemented.</returns>
protected virtual bool ValidateParameters(HttpContext context)
{
    return true;
}
```

The `ProcessRequestCore` method is an abstract method, which means that it must be overridden by any child classes. This is where our child classes will put their logic, not having to worry about any of the details of the generic handler.  The `ValidateParameters` method returns `true` indicating that everything is fine and the request should proceed without errors. Implementors can override this method to check for query string parameters, return `false`, and let it explode with an internal server error.

```C#
/// <summary>
/// Process the incoming HTTP request.
/// </summary>
/// <param name="context">The <see cref="HttpContext"/> for the request.</param>
public void ProcessRequest(HttpContext context)
{
    if (context == null)
    {
        throw new ArgumentNullException("context");
    }

    if (!this.ValidateParameters(context))
    {
        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
        context.Response.End();
        return;
    }

    context.Response.ContentType = this.ContentMimeType;

    this.ProcessRequestCore(context);
}
```

Finally, we're modifying the `ProcessRequest` method to use what we've added and pass control over to `ProcessRequestCore`. At this point we have a fairly *generic* generic handler. This is likely in your arsenal already; it's certainly [in ours][pbcoreh] (with a few more bells and a few less whistles).

Access to Aptify
----------------

Providing access to Aptify basically just means adding properties for the EBusinessGlobal, AptifyApplication, and DataAction objects:

```C#
/// <summary>
/// Gets the Aptify EBusiness Global object.
/// </summary>
protected EBusinessGlobal EBusinessGlobal
{
    get
    {
        var ebusinessGlobal =
          HttpContext.Current.Items["PB_EBusinessGlobal"] as EBusinessGlobal;

        if (ebusinessGlobal == null)
        {
            HttpContext.Current.Items["PB_EBusinessGlobal"] =
              ebusinessGlobal =
              new EBusinessGlobal();
        }

        return ebusinessGlobal;
    }
}

/// <summary>
/// Gets the Aptify Application object.
/// </summary>
protected AptifyApplication AptifyApplication
{
    get
    {
        var aptifyApplication =
          HttpContext.Current.Items["PB_AptifyApplication"] as AptifyApplication;

        if (aptifyApplication == null)
        {
            HttpContext.Current.Items["PB_AptifyApplication"] =
              aptifyApplication =
              this.EBusinessGlobal.GetAptifyApplication(
                HttpContext.Current.Application, HttpContext.Current.User);
        }

        return aptifyApplication;
    }
}

/// <summary>
/// Gets the Aptify Data Action object.
/// </summary>
protected DataAction DataAction
{
    get
    {
        var dataAction =
          HttpContext.Current.Items["PB_DataAction"] as DataAction;

        if (dataAction == null)
        {
            HttpContext.Current.Items["PB_DataAction"] =
              dataAction =
              this.EBusinessGlobal.GetDataAction(
                HttpContext.Current.Application, HttpContext.Current.User);
        }

        return dataAction;
    }
}
```

Here we have three protected properties for `EBusinessGlobal`, `AptifyApplication`, and `DataAction`. This gives child classes quick access to the main Aptify entry points. Lazy loading them into a per-request cache avoids unnecessary or multiple instantiations.

> **Pro-tip**
> We have noticed a 20-200ms overhead for instantiations of `AptifyApplication` and `DataAction`. Reuse and pass these around in your requests to save yourself and your users a measurable amount of time. Storing them in `HttpContext.Current.Items` makes it easy.

Finally, Default to No Cache
----------------------------

The only thing left to do is to set the response's cache policy:

```C#
/// <summary>
/// Sets the cacheability of the response.  Defaults to none.
/// </summary>
/// <param name="cache">The policy object.</param>
protected virtual void SetResponseCachePolicy(HttpCachePolicy cache)
{
    if (cache == null)
    {
        throw new ArgumentNullException("cache");
    }

    cache.SetCacheability(HttpCacheability.NoCache);
    cache.SetNoStore();
    cache.SetExpires(DateTime.MinValue);
}
```

This new method can of course be overridden by implementations of the class, but by default it sets the response to disable caching. Most often, this is ideal because we want to make sure that the server code runs for every request. We may have gone a little overboard here by calling all three of the above `HttpCachePolicy` methods, but our experience has shown that all three have been needed in various scenarios.

Of course, don't forget that we also need to change our `ProcessRequest` method to add a line to call our new `SetResponseCachePolicy` method:

```C#
this.SetResponseCachePolicy(context.Response.Cache);
```

And that, my friends, [is good enough][code].

Ready, Set, Go
--------------

Now that the base class is ready to go, creating a generic handler will be as easy as inheriting from our `HttpHandlerBase` class and doing whatever we need to do in the `ProcessRequestBase` method. Of course, we can also override `ContentMimeType` and `ValidateParameters` like so:

```C#
using System.Web;

public class CustomHandler : HttpHandlerBase
{
    protected override string ContentMimeType
    {
        get { return "application/json"; }
    }

    protected override void ProcessRequestCore(HttpContext context)
    {
        // What shall we do?
    }

    protected override bool ValidateParameters(HttpContext context)
    {
        return true;
    }
}
```

There we have it. We'll look at some of the possibilities of how to use this in the real world in future posts. Until then, au revoir.

[perb]: http://www.perbyte.com/
[code]: https://gist.github.com/jasondavidcarr/53b081d59372878660b7
[apt]: http://www.aptify.com/
[iana]: http://www.iana.org/assignments/media-types/media-types.xhtml
[pbcoreh]: https://github.com/perbyte/pb-core/blob/master/src/PerByte.Core.Web/HttpHandlerBase.cs
[jason]:http://www.jasoncarr.com/