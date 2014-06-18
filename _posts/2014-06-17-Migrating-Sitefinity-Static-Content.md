---
layout:      post
date:        2014-06-17
title:       "Migrating Sitefinity Static Content"
meta:        "A boy and his blob"
description: ""
comments:    true
author:      jason
categories:  
tags:        sitefinity
---

I recently had the opportunity to move all of the static content (images and documents) from one [Sitefinity][site] 4.x installation to another, the destination being Sitefinity 6.x. [Telerik][tel] does provide a [migration solution][mig] for Enterprise installations; however, I would imagine that the majority of Sitefinity customers are not running the enterprise version.

All of the Sitefinity static content is stored in SQL Server, not as files in the file system as you would expect. Therefore, I found it easiest to migrate the content via simple SQL scripts.

Unfortunately, there's an extreme lack of documentation on the structure of the Sitefinity database. Therefore, I built these scripts mostly off of trial and error. Keep in mind that the data structure does vary slightly between Sitefinity versions, so you might find an error or two to work through in the SQL. Obviously, make a backup of your database before proceeding.

tl;dr
-----

As always, if you just want to grab the script and run, you can get the whole thing [right here][code].

Preparation
-----------

Ideally, before running these scripts you would ensure that both the old and new databases are in the same SQL Server instance; this certainly makes life easier. Alternatively, you can use [SQL Server Linked Servers][link] to connect to both instances at once.

Obviously, you'll need to replace the `SitefinityOld` and `SitefinityNew` database names with your own database names. If you're using linked servers, you'll need to add the instance names as well.

Blowing Chunks
--------------

Sitefinity apparently uses the `sf_chunks` table to store all of the binary data. Therefore, obviously it's the most massive of the transfers. Here's the script to bring it over:

{% highlight sql %}

INSERT INTO SitefinityNew..sf_chunks (sze, ordinal, file_id, dta, voa_version)
SELECT c.sze, c.ordinal, c.file_id, c.dta, c.voa_version
FROM SitefinityOld..sf_chunks c
WHERE c.file_id IN (SELECT file_id FROM SitefinityOld..sf_media_content)

{% endhighlight %}

Content Pieces
--------------

The `sf_content_pieces` table contains most of the relevant metadata for the content. I never attempted to identify exactly what `sf_approval_tracking_map` is used for, but I was getting errors when I didn't include it; I assume it contains important information for content workflow. Without further adieu:

{% highlight sql %}

INSERT INTO SitefinityNew..sf_media_content
(votes_sum,votes_count, visible, views_count, vrsion, url_name_, title_, status, source_key,
publication_date, post_rights, ownr, original_content_id, last_modified_by, last_modified, content_id,
expiration_date, email_author, draft_culture, description_, default_page_id, date_created, content_state,
approve_comments, app_name, allow_track_backs, allow_comments, lgcy_tmb_strg, uploaded, total_size,
tmb_vrsn, parent_id, ordinal, number_of_chunks, tmb_regen, mime_type, item_default_url_, inherits_permissions,
folder_id, file_path, file_id, extension, chunk_size, can_inherit_permissions, blob_storage, author_,
approval_workflow_state_, id, voa_class, voa_version, parts_, width, height, alternative_text_, width2, height2)
SELECT votes_sum,votes_count, visible, views_count, vrsion, url_name_, title_, status, source_key,
publication_date, post_rights, ownr, original_content_id, last_modified_by, last_modified, content_id,
expiration_date, email_author, draft_culture, description_, default_page_id, date_created, content_state,
approve_comments, app_name, allow_track_backs, allow_comments, lgcy_tmb_strg, uploaded, total_size,
tmb_vrsn, parent_id, ordinal, number_of_chunks, tmb_regen, mime_type, item_default_url_, inherits_permissions,
folder_id, file_path, file_id, extension, chunk_size, can_inherit_permissions, blob_storage, author_,
approval_workflow_state_, id, voa_class, voa_version, parts_, width, height, alternative_text_, width2, height2
FROM SitefinityOld..sf_media_content

INSERT INTO SitefinityNew..sf_approval_tracking_record_map (id, voa_version)
SELECT id, voa_version
FROM SitefinityOld..sf_approval_tracking_record_map

{% endhighlight %}

Thumbnails and URLs
-------------------

The `sf_media_thumbnails` and `sf_url_data` tables contain exactly what you'd expect. The URLs are particularly important, as none of your content will work without them. Here goes:

{% highlight sql %}

INSERT INTO SitefinityNew..sf_media_thumbnails
(width, typ, total_size, content_id, nme, mime_type, id, height, file_id, dta, uploaded, number_of_chunks, chunk_size, voa_version)
SELECT width, typ, total_size, content_id, nme, mime_type, id, height, file_id, dta, uploaded, number_of_chunks, chunk_size, voa_version
FROM SitefinityOld..sf_media_thumbnails

INSERT INTO SitefinityNew..sf_url_data
(url, redirect, qery, last_modified, is_default, id, disabled, culture, app_name, voa_version, voa_class, content_id, id2, item_type)
SELECT url, redirect, qery, last_modified, is_default, id, disabled, culture, app_name, voa_version, voa_class, content_id, id2, item_type
FROM SitefinityOld..sf_url_data
WHERE app_name = '/Libraries'

{% endhighlight %}

Libraries
---------

Finally, none of the content pieces in any of the custom libraries will show up without bringing the `sf_libraries` table over. So here we go:

{% highlight sql %}

INSERT INTO SitefinityNew..sf_libraries
(votes_sum, votes_count, visible, views_count, vrsion, url_name_, title_,
status, source_key, publication_date, post_rights, ownr, original_content_id,
last_modified_by, last_modified, content_id, expiration_date, email_author, draft_culture,
description_, default_page_id, date_created, content_state, approve_comments, app_name,
allow_track_backs, allow_comments, running_task, cache_profile, tmb_regen, max_size,
max_item_size, item_default_url_, inherits_permissions, security_provider,
client_cache_profile, can_inherit_permissions, blob_storage, voa_class, resize_on_upload,
new_size)
SELECT votes_sum, votes_count, visible, views_count, vrsion, url_name_, title_,
status, source_key, publication_date, post_rights, ownr, original_content_id,
last_modified_by, last_modified, content_id, expiration_date, email_author, draft_culture,
description_, default_page_id, date_created, content_state, approve_comments, app_name,
allow_track_backs, allow_comments, running_task, cache_profile, tmb_regen, max_size,
max_item_size, item_default_url_, inherits_permissions, security_provider,
client_cache_profile, can_inherit_permissions, blob_storage, voa_class, resize_on_upload,
new_size
FROM SitefinityOld..sf_libraries
WHERE content_id NOT IN (SELECT content_id FROM SitefinityNew..sf_libraries)

{% endhighlight %}

Did it work?
------------

If all queries ran successfully, you should now have all of your static content in your new Sitefinity installation. Go ahead and log into Sitefinity and confirm that it's all there. Keep in mind that the above scripts transferred everything that I needed for my particular situation, but permissions were not one of them. If you need permissions, you'll need to dive in to figure that piece out yourself. There may also be some further data that I missed, but everything that we were using was brought over just fine.

Let us know in the comments if this did or did not work for you, and if you happen to figure out how to pull the permissions, do us all a favor and post that here as well. :smile:

[site]: http://www.sitefinity.com/
[tel]: http://www.telerik.com/
[mig]: http://www.sitefinity.com/sitesync
[code]: https://gist.github.com/jasondavidcarr/720f1c677fc906fe929c
[link]: http://www.c-sharpcorner.com/uploadfile/suthish_nair/linked-servers-in-sql-server-2008/
