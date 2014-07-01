$(function () {
	// For the about-us profiles.
	$('.expand').click(function (e) {
		e.preventDefault();
		$(this).parents('.span6')
		.children('.polaroid')
		.css('overflow', 'visible')
		.css('max-height', '1000px')
		.css('height', 'auto')
		.css('padding-bottom', '30px');
		$(this).hide();
	});

	// Smooth scroll-to.
	$("body").on("click", "a", function () {
		fromTop = 120;
		href = $(this).attr("href");

		// If href is set, points to an anchor, and the anchor is not simply #
		if (href && href.indexOf("#") != -1 && href.indexOf("#") != href.length - 1) {
			href = href.substring(href.indexOf("#"));
			if ($(href).length > 0) { // If element exists
				$('html, body').animate({ scrollTop: $(href).offset().top - fromTop }, 400);
				_gaq.push(['_trackPageview', location.pathname + location.search + href]);
				return false;
			}
		}
	});

	$("#contact-form").validate({
		rules: {
			name: {
				required: true
			},
			organization: {
				required: true
			},
			email: {
				required: true,
				email: true
			},
			message: {
				required: true
			}
		}
	});

	$("#contact-form").submit(function (e) {
		if ($("#contact-form").valid()) {
			e.preventDefault();

			var formData = $("#contact-form").serialize();
			$.ajax({
				type: "POST",
				url: "SendIt.ashx",
				data: formData,
				dataType: "json",
				success: function (data) {
					$("#messageSent").show(1000);
					$("#message").hide(1000);
				}
			});
		}
	});
});
