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

First off, as this is my first post, let me introduce myself. I am Josh's #1 peon, er, esteemed colleague, at [PerByte][perb]. We've made careers out of customizing and extending [Aptify][apt] both on and off the web (though obviously our careers expand well past the bounds of Aptify).

So let's talk generic handlers. Aptify does happen to have a base HTTP handler class, but they seem to think that images and downloads are the only reason to use a generic handler, and it's more than a bit awkward to use. This article aims to show you how to create a proper base HTTP handler class that is easy to use and provides full access to Aptify.

tl; dr
------

If you're like me and just want the code, you can easily view it all in one piece [right here][code].

What is an ASP.NET generic handler?
-----------------------------------

In ASP.NET, generic handlers are typically used in situations where standard web page functionality doesn't fully apply. For example, they can be used to return XML or JSON data to be picked up by another page or application, they can be used similarly to a web service to receive and send data, or they can always be used in the ways Aptify intended: to dynamically size and process images or for file downloads.

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
        get { return false; }
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

This is a generic handler that does nothing more than output "Hello World" as a text file. The ProcessRequest method is the entry point, and simply sets the returned content type to "text/plain" (which represents a simple text file), and writes "Hello World" to the response output. Navigating to the URL of this handler would simply show "Hello World" in clear text in your browser.

The IsReusable property specifies whether or not an existing instance of the class can be re-used for another request. The safest value to use here is false, which specifies that a new instance of our HttpHandlerBase class will be created for every request. This is safest because reusable handlers must be type safe and are often accessed concurrently, so saving state in your handler can become an issue. However, performance can obviously be gained by setting this value to true if you are careful not to run into these issues.

Allowing for Easy Implementations of Extended Classes
-----------------------------------------------------

Obviously the goal for our base class is to provide base functionality and make it easy to extend the class. Let's add in some code to help out:

```C#

using System;
using System.Net;
using System.Web;

/// <summary>
/// Base class for custom <see cref="IHttpHandler"/> implementations that need access to Aptify.
/// </summary>
public abstract class HttpHandlerBase : IHttpHandler
{
    /// <summary>
    /// Gets a value indicating whether this instance can be reused between successive requests.
    /// </summary>
    public virtual bool IsReusable
    {
        get { return false; }
    }

    /// <summary>
    /// Gets the MIME type of the response for this request.
    /// </summary>
    protected virtual string ContentMimeType
    {
        get { return "text/html"; }
    }

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
}

```

Here we've added a new ContentMimeType property, two new protected methods for child classes to override, and of course made some changes to our ProcessRequest method. Let's first take a look at the two methods to be overridden.

The ProcessRequestCore method is an abstract method, which means that it must be overridden by any child classes. This is where our child classes will put their logic, not having to worry about any of the details of the generic handler.  The ValidateParameters method by default just returns true indicating that everything is fine and the request should proceed without errors. However, child classes can override this method to check for query string parameters, etc., and can return false, which will of course result in an internal server error.

We've also added the ContentMimeType property, which can also be overridden by child classes to specify the type of data that is returned from the request. For example, if a PNG image is returned, this could be overridden to specify a mime type of "image/png". Mime types are simply a way of specifying what type of file is returned; the possible values can be easily looked up on the web.

Finally, the changes to our ProcessRequest method basically just call our ValidateParameters method and return with an internal server error if necessary, hook up the mime type from the property, and call our new ProcessRequestCore method. Simple enough?

Access to Aptify
----------------

Providing access to Aptify basically just means adding properties for the EBusinessGlobal, AptifyApplication, and DataAction objects:

```C#

    private EBusinessGlobal ebusinessGlobal;
    private AptifyApplication aptifyApplication;
    private DataAction dataAction;

    /// <summary>
    /// Gets the Aptify EBusiness Global object.
    /// </summary>
    protected EBusinessGlobal EBusinessGlobal
    {
        get
        {
            if (this.ebusinessGlobal == null)
            {
                this.ebusinessGlobal = new EBusinessGlobal();
            }

            return this.ebusinessGlobal;
        }
    }

    /// <summary>
    /// Gets the Aptify Application object.
    /// </summary>
    protected AptifyApplication AptifyApplication
    {
        get
        {
            if (this.aptifyApplication == null)
            {
                this.aptifyApplication = this.EBusinessGlobal.GetAptifyApplication(HttpContext.Current.Application, HttpContext.Current.User);
            }

            return this.aptifyApplication;
        }
    }

    /// <summary>
    /// Gets the Aptify Data Action object.
    /// </summary>
    protected DataAction DataAction
    {
        get
        {
            if (this.dataAction == null)
            {
                this.dataAction = this.EBusinessGlobal.GetDataAction(HttpContext.Current.Application, HttpContext.Current.User);
            }

            return this.dataAction;
        }
    }

```

Here we have three protected properties and three private variables: one each for EBusinessGlobal, AptifyApplication, and DataAction. The properties are set up so that the private variables will be instantiated only once, and only when necessary, saving the class from the potential performance hits of multiple or unnecessary instantiations.  The EbusinessGlobal object is used to instantiate the AptifyApplication and DataAction objects.

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

This new method can of course be overridden by implementations of the class, but by default it sets the response to disable caching. This is most often ideal because we want to make sure that the server code runs for every request. We may have gone a little overboard here by calling all three of the above HttpCachePolicy methods, but our experience has shown that all three have been needed in various scenarios.

Of course, don't forget that we also need to change our ProcessRequest method to add a line to call our new SetResponseCachePolicy method:

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

        this.SetResponseCachePolicy(context.Response.Cache);

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

Ready, Set, Go
--------------

Now that the base class is ready to go, creating a generic handler will be as easy as inheriting from our HttpHandlerBase class and doing whatever we need to do in the ProcessRequestBase method. Of course, we can also override ContentMimeType and ValidateParameters like so:

```C#

using System.Web;

public class CustomHandler : HttpHandlerBase
{
    protected override string ContentMimeType
    {
        get
        {
            // Perhaps we're returning XML for this request?
            return "text/xml";
        }
    }

    protected override void ProcessRequestCore(HttpContext context)
    {
        // What shall we do?
    }

    protected override bool ValidateParameters(HttpContext context)
    {
        // Anything we need to validate?
        return true;
    }
}

```

There we have it. We'll look at some of the possibilities of how to use this in the real world in future posts. Until then, au revoir.

[perb]: http://www.perbyte.com/
[code]: https://gist.github.com/jasondavidcarr/53b081d59372878660b7
[apt]: http://www.aptify.com/