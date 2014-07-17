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

Running a Process
-----------------

Usually when starting a process, you would simply use the quick and easy `Process.Start` static method. However, in order to allow for more complicated operations, you'll need to instantiate the `ProcessStartInfo` and `Process` classes like so:

{% highlight c# %}

private void RunProcess()
{
    // Create a new instance of ProcessStartInfo, point it to C:\CDRDAO.exe, and use "read-cd" as
    // the command line parameters
    var info = new System.Diagnostics.ProcessStartInfo(@"C:\CDRDAO.exe", "read-cd");

    // Create the new process and assign the info we created above
    var process = new System.Diagnostics.Process();
    process.StartInfo = info;
  
    // Start the process
    process.Start();
}

{% endhighlight %}

Hiding the Window
-----------------

Hiding the window is as simple as setting the `CreateNoWindow` property of the `ProcessStartInfo` class to `true`. Don't take a wild guess like I did and try to set the `WindowStyle` property to `ProcessWindowStyle.Hidden`, as it appears to do nothing at all.

{% highlight c# %}

// Hide the ugly black box
info.CreateNoWindow = true;

{% endhighlight %}

Redirecting Output
------------------

This is where it gets a tad bit more complicated, as there are numerous things you must do to make the output redirections work. Let's just lay down the code and then we can walk through it:

{% highlight c# %}

private void RunProcess()
{
    var info = new System.Diagnostics.ProcessStartInfo(@"C:\CDRDAO.exe", "read-cd");
    info.CreateNoWindow = true;

    // Allows for redirecting output
    info.UseShellExecute = false;
    
    // Redirect standard output
    info.RedirectStandardOutput = true;

    var process = new System.Diagnostics.Process();
    process.StartInfo = info;

    // Turn on events for this instance of the Process class
    process.EnableRaisingEvents = true;

    // Assign the OutputDataReceived event for processing the output
    process.OutputDataReceived += this.process_OutputDataReceived;

    // Allows cross-thread operations in this class
    process.SynchronizingObject = this;
    
    process.Start();

    // Enable reading the output
    process.BeginOutputReadLine();
}

private void process_OutputDataReceived(object sender, System.Diagnostics.DataReceivedEventArgs e)
{
	// Process the output
}

{% endhighlight %}

The first new thing we've added here is `info.UseShellExecute = false;`. By default, the `Process` class uses the system shell to execute processes. Several things are affected by this, but most important is that you cannot redirect output when using the system shell. However, when not using the system shell (setting `info.UseShellExecute` to `false`), you must provide the full, rooted path to the EXE file, as the current working directory does not apply.

Next we have `info.RedirectStandardOutput = true;`, which simply tells the process that we want to redirect the output to our application. We also need to enable raising events on the `Process` class, and hook up an event handler to the `OutputDataReceived` event. This new `process_OutputDataReceived` event handler will allow us to do whatever we want with the output from the CDRDAO process.

Furthermore, we set the `SynchronizingObject` property to the instance of our class.

Drawing Blanks?
---------------

You'd think you'd be done here, but after all that in my testing with CDRDAO, I wasn't getting any output in my `process_OutputDataReceived` event. It turns out that CDRDAO happens to output all its messages as standard errors, instead of standard output. Therefore, it's a good idea to (and you might need to) redirect/capture the standard error output as well:

{% highlight c# %}

private void RunProcess()
{
    var info = new System.Diagnostics.ProcessStartInfo(@"C:\CDRDAO.exe", "read-cd");
    info.UseShellExecute = false;
    info.RedirectStandardOutput = true;
    info.CreateNoWindow = true;

    // Redirect error output
    info.RedirectStandardError = true;

    var process = new System.Diagnostics.Process();
    process.StartInfo = info;
    process.EnableRaisingEvents = true;
    process.OutputDataReceived += this.process_OutputDataReceived;

    // Assign the ErrorDataReceived event for processed the error output
    process.ErrorDataReceived += this.process_ErrorDataReceived;

    process.SynchronizingObject = this;
    process.Start();
    process.BeginOutputReadLine();

    // Enable reading the error output
    process.BeginErrorReadLine();
}

private void process_ErrorDataReceived(object sender, System.Diagnostics.DataReceivedEventArgs e)
{
    // Process the error output
}

private void process_OutputDataReceived(object sender, System.Diagnostics.DataReceivedEventArgs e)
{
    // Process the output
}

{% endhighlight %}

The three new lines added here should be fairly obvious, as they follow the same logic as the standard output: `RedirectStandardError` which tells the process to redirect the output, `ErrorDataReceived` which hooks up the event, and `BeginErrorReadLine` which initializes capturing the error output.

Consuming the Output
--------------------

Obviously, there are a number of things you can do in the `process_ErrorDataReceived` and `process_OutputDataReceived` events, such as parsing the output to control the logic of your application, or simply showing the output to the user. It's also important to note that you can combine those two event handlers into one without issues, and just point both `OutputDataReceived` and `ErrorDataReceived` to the same event handler method.

Then, in a Windows Forms application, you can send your output to a `ReadOnly` and `Multiline` `TextBox` control to display it nicely. It works best if you do it like this:

{% highlight c# %}

private void process_DataReceived(object sender, System.Diagnostics.DataReceivedEventArgs e)
{
    // If no data or the form was closed/disposed, don't continue
    if (e.Data == null || this.IsDisposed)
    {
        return;
    }

    // Use this method for performance reasons
    this.logTextBox.AppendText(e.Data + '\n');
}

{% endhighlight %}

Here, we simply check to make sure `e.Data` isn't `null` and that the form isn't disposed, as otherwise if the user closes the form before the process has exited, [bad things will happen][btwh].

Finally, it's important to use the `AppendText` method of the `TextBox` control for performance reasons. The method will also automatically scroll to the end with each append operation.

Still Reading?
--------------

Let us know in the comments if you run into any issues or do anything worth bragging about.

[labo]: http://www.launchbox-app.com/
[cdrdao]: http://cdrdao.sourceforge.net/
[btwh]: http://www.georgialogcabin.org/news/George-W-Bush-Elected-President/200011271805.shtml