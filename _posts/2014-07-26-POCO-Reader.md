---
layout:      post
date:        2014-07-26
title:       "SQL as a POCO with minimal overhead"
meta:        "Sometimes things are simple"
description: ""
comments:    true
author:      josh
categories:  
tags:        .net data
---

I've been working on a simple project. Really simple. I need to read data from a database, compare it to some other data (not from a database), and do something with that comparison.

The data representation itself needs to end up in a strongly typed class as the comparison code is already written and it expects those classes. They're regular old POCOs.

> **[POCO](http://en.wikipedia.org/wiki/Plain_Old_CLR_Object)** - *Plain Old CLR Object*

> Its effective, plain, and independent. And it doesn't care about anything.

##What should we do?##

So I need to get the data from SQL into these objects. A problem that has been solved really well many times.

###How about ORMs?###

For data access a well designed ORM can be a huge boon to productivity and code quality. Using Entity Framework or NHibernate is like riding shotgun in a Hummer Limo. You'll have a chauffeur and you'll get there in style. You will, however, need to speak up and yell at the driver if you know a better route, assuming they listen, and good luck finding a close parking spot with that behemoth.

I'm just looking to run a couple of SQL statements and get the data. For this situation they really take the simple out of KISS. Keep it. Stupid.

###How about Micro-ORMs?###

Micro-ORMs are a really good fit, in general, for this type of problem. Given that I want to deal with strongly typed objects there is [PetaPOCO](http://www.toptensoftware.com/petapoco/) and [Dapper](https://code.google.com/p/dapper-dot-net/). If I could use dynamic types I could use the wonderful [Massive](https://github.com/robconery/massive).

If an ORM is like riding in a Hummer Limo than a Micro-ORM is like riding a bike. They're efficient and unobtrusive. You can cut through most shortcuts and you can park anywhere. A bike is great but still overkill when all I need to do is see who rang the doorbell.

Dynamically emitted mapping code and a fair bit of reflection for code that's going to run once and all at once seems a bit out of place.

###Why not write code the long way?###

I nearly chose this option. Shameful I know. It's quick and dirty but it works. Then I remembered that I've been tyring to live up to one of my modern code-writing mantras ***only write code that only you can write***. In short, don't write boilerplate code if you can help it.

###What's left?###

There really should be a middle ground. A Micro-Micro-ORM perhaps. For my purposes I have created an incredibly simple set of extension methods to let me write some manner of elegance that fits my purposes. There is much to be improved but I figured if I did that, I'd end up with MassiveDapperPoco.

Assuming this is our POCO:

{% highlight c# %}
public class UselessData
{
  public int ID { get; set; }
  public string Name { get; set; }
}
{% endhighlight %}

Let's start with the boilerplate:

{% highlight c# %}
public IList<UselessData> GimmeThatUselessData(string connectionString)
{
  var data = new List<UselessData>();

  using (var connection = new SqlConnection(connectionString))
  using (var command = new SqlCommand("SELECT ID, Name FROM UselessData", connection))
  {
    connection.Open();
    using (var reader = command.ExecuteReader(CommandBehavior.CloseConnection))
    {
      while (reader.Read())
      {
        data.Add(new UselessData { ID = reader.GetInt32(0), Name = reader.GetString(1) });
      }
    }
  }

  return data;
}
{% endhighlight %}

Nothing terribly exciting. It's smelly, but it works. Simply the presence of LINQ can make our code a little prettier:

{% highlight c# %}
public IList<UselessData> GimmeThatUselessData(string connectionString)
{
  var data = new List<UselessData>();

  using (var connection = new SqlConnection(connectionString))
  using (var command = new SqlCommand("SELECT ID, Name FROM UselessData", connection))
  {
    connection.Open();
    using (var reader = command.ExecuteReader(CommandBehavior.CloseConnection))
    {
      return reader
        .Cast<IDataRecord>
        .Select(r => new UselessData { ID = r.GetInt32(0), Name = r.GetString(1) });
    }
  }

  return data;
}
{% endhighlight %}

We hid the loop in LINQ but its doing all sorts of extra work behind the scenes. This uses `IDataReader.GetEnumerator` which copies values around a few times, instantiates a number of extra objects, and generally causes more overhead than we really need.

The code also doesn't *look* that much better so the value is minimal. We can do better of course. With a set of easily reused extension methods and some simple enumeration code we can get to here:

{% highlight c# %}
public IList<UselessData> GimmeThatUselessData(string connectionString)
{
  using (var connection = new SqlConnection(connectionString))
  {
    return connection.ExecutePocoReader(
      "SELECT ID, Name FROM UselessData",
      r => new UselessData { ID = r.GetInt32(0), Name = r.GetString(1) }).ToList();
  }
}
{% endhighlight %}

And of course if you use some manner of shared database context in your app this could easily be a one liner:

{% highlight c# %}
public IList<UselessData> GimmeThatUselessData()
{
  DB.Current.ExecutePocoReader(
    "SELECT ID, Name FROM UselessData",
    r => new UselessData { ID = r.GetInt32(0), Name = r.GetString(1) }).ToList();
}
{% endhighlight %}

##How'd we do that?##

The important bits are here:

{% highlight c# %}
public static PocoReader<T> ExecutePocoReader<T>(this IDbConnection connection, string commandText, Func<IDataRecord, T> convertFunc)
{
  if (connection == null)
  {
    throw new ArgumentNullException("connection");
  }

  using (var command = connection.CreateCommand())
  {
    command.CommandText = commandText;
    command.CommandType = CommandType.Text;

    if (connection.State != ConnectionState.Open)
    {
      connection.Open();
    }

    var reader = connection.ExecuteReader(commandText, CommandBehavior.Default);
    return new PocoReader<T>(reader, convertFunc, false);
  }
}
{% endhighlight %}
Current version of this available on [Github](https://github.com/perbyte/core/blob/master/src/PerByte.Core/Data/IDbConnectionExtensions.cs).

Basically some sugar to call our POCO reader.

{% highlight c# %}
/// <summary>
/// A lightweight SQL to LINQ style wrapper on <see cref="IDataReader"/>.
/// </summary>
/// <typeparam name="T">The type of the POCO.</typeparam>
public class PocoReader<T> : IEnumerable<T>
{
  /// <summary>
  /// Local storage of the data reader.
  /// </summary>
  private readonly IDataReader dataReader;

  /// <summary>
  /// Local storage for the translation function between the SQL and the POCO.
  /// </summary>
  private readonly Func<IDataRecord, T> convertFunc;

  /// <summary>
  /// Local storage for whether we should close the reader when fully enumerated.
  /// </summary>
  private readonly bool closeReader;

  /// <summary>
  /// Initializes a new instance of the <see cref="PocoReader{T}"/> class.
  /// </summary>
  /// <param name="dataReader">The data reader to retrieve the data from and iterate over.</param>
  /// <param name="convertFunc">The translation object to convert from the SQL to the POCO.</param>
  /// <param name="closeReader">A value indicating whether or not to close the reader when the enumeration is exhausted.</param>
  public PocoReader(IDataReader dataReader, Func<IDataRecord, T> convertFunc, bool closeReader)
  {
    Ensure.ArgumentNotNull(dataReader, "dataReader");
    Ensure.ArgumentNotNull(convertFunc, "convertFunc");
    this.dataReader = dataReader;
    this.convertFunc = convertFunc;
    this.closeReader = closeReader;
  }

  /// <summary>
  /// Returns an enumerator that iterates through the reader.
  /// </summary>
  /// <returns>An enumerator for the reader.</returns>
  public IEnumerator<T> GetEnumerator()
  {
    while (this.dataReader.Read())
    {
      yield return this.convertFunc(this.dataReader);
    }

    if (this.closeReader)
    {
      this.dataReader.Close();
    }
  }

  /// <summary>
  /// Returns an enumerator that iterates through the reader.
  /// </summary>
  /// <returns>An enumerator for the reader.</returns>
  IEnumerator IEnumerable.GetEnumerator()
  {
    return this.GetEnumerator();
  }
}
{% endhighlight %}
// Current version available on [Github](https://github.com/perbyte/core/blob/master/src/PerByte.Core/Data/PocoReader.cs)

Simple, right? Many dozens of other sugars available as part of our [Core](https://github.com/perbyte/core) series of projects. Have a read, give [me a shout](https://twitter.com/joshucar), and enjoy.
