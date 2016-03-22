$(document).ready(function() {
	$("#toggle-nav").click(function() {
		$('html, body').animate({scrollTop: '0px'}, 0);
		$("nav").toggle();
		$("#header").css("position","relative");
		if( $("nav").is(":visible") ) {
			$("#header").css("position","relative")
		} else {
			$("#header").css("position","fixed");
		};
	});

});

// $(window).resize(function() {
	// if ($("#logo5 a").css("margin-left") !== "0px"){
			// $( ".social" ).next().addClass("clearfix");	
	// } else {
		// $( ".social" ).next().removeClass("clearfix");
	// }
// });

// if "nav a" bg color is not #282b2b, show the div with clearfix. If it is, hide the div with clearfix.
// On wide screen entry, div will be hidden until the screen moves to tablet size

// if ($("nav a").css("background-color") == "#61d35a"){
			// $( ".social" ).after( "<div class='clearfix'></div>" );
		// } else {
			// $( "header .clearfix" ).remove();
		// }


