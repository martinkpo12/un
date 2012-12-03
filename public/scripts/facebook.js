function logResponse(response) {
	if (console && console.log) {
		console.log('The response was', response);
	}
}

!function ($) {
	$(function () {
	
		// Set up so we handle click on the buttons
		$('#postToWall').click(function() {
			FB.ui(
			{
				method : 'feed',
				link   : $(this).attr('data-url')
			},
			function (response) {
				// If response is null the user canceled the dialog
				if (response != null) {
					logResponse(response);
				}
			}
			);
		});
	
		$('#sendToFriends').click(function() {
			FB.ui(
			{
				method : 'send',
				link   : $(this).attr('data-url')
			},
			function (response) {
				// If response is null the user canceled the dialog
				if (response != null) {
					logResponse(response);
				}
			}
			);
		});
	
		$('#sendRequest').click(function() {
			FB.ui(
			{
				method  : 'apprequests',
				message : $(this).attr('data-message')
			},
			function (response) {
				// If response is null the user canceled the dialog
				if (response != null) {
					logResponse(response);
				}
			}
			);
		});
	
		$('#logout').click(function(e) {
	 		e.preventDefault();
	 		FB.logout(handleSessionResponse);
	 	});
	 	
	 	$('.fbView').click(function() {
		 	
		 	
		 	FB.api(	'/me/iortmun:view',
		 			'post',
		 			{
		 				country : window.location.href
		 			},
		 			function (response) {
		 				console.log(response);
		 			}
		 		);
	
	 	});
	 	
	 	$('.fbFav').click(function() {
		 	
		 	FB.api(	'/me/iortmun:favourite',
		 			'post',
		 			{
		 				country : window.location.href
		 			},
		 			function (response) {
		 				console.log(response);
		 			}
		 		);
	
	 	});
	 	
	 	$('.fbLike').click(function() {
		 	
		 	FB.api(	'/me/iortmun:like',
		 			'post',
		 			{
		 				country : window.location.href
		 			},
		 			function (response) {
		 				console.log(response);
		 			}
		 		);
	
	 	});
	 	
	 	$('.add').click(function () {
		 	
		 	console.log("here");
		 	
		 	$('#table-countries').slideToggle('slow');
		 	$('#newCountry').slideToggle('fast');
		 	
	 	});
	
	 	// handle a session response from any of the auth related calls
	 	function handleSessionResponse() {
	    	FB.api('/me', function(response) {
	        	console.log(response);
	/*         	$('#user-info').html(response.id + ' - ' + response.name); */
	        });
	        document.location.reload(true);
	    }
	});
}