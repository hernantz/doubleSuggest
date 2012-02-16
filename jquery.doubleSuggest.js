/*
 * doubleSuggest - Version 0.1
 *
 * This Plug-In will set up a UI that suggest results for your 
 * search queries as you type. 
 * It will display two types of suggestions, first (and faster) the local data 
 * and also the results from a remote search query. 
 * It supports keybord navigation and multiple doubleSuggest fields on the same page.
 *
 * Built on top of the jSuggest plugin by: hernantz | www.gotune.to
 *
 * This doubleSuggest jQuery plug-in is licensed under MIT license:
 * http:// www.opensource.org/licenses/mit-license.php
 */
 
(function($){
	$.fn.doubleSuggest = function(options) {
		var defaults = {
			localSource: {}, // Object where doubleSuggest gets the suggestions from.
			remoteSource: false, // URL where doubleSuggest gets the suggestions from.
			startText: 'Search', // Text to display when the doubleSuggest input field is empty.
			emptyText: false, // Text to display when their are no search results.
			loadingText: 'Loading...', // Text to display when the results are being retrieved.
			newItem: false, // If set to false, the user will not be able to add new items by any other way than by selecting from the suggestions list.
			selectedItemProp: 'name', // Value displayed on the added item
			seekVal: 'name', // Comma separated list of object property names.
			queryParam: 'q', // The name of the param that will hold the search string value in the AJAX request.
			queryLimit: false, // Number for 'limit' param on ajax request.
			extraParams: '', // This will be added onto the end of the AJAX request URL. Make sure you add an '&' before each param.
			matchCase: false, // Make the search case sensitive when set to true.
			minChars: 1, // Minimum number of characters that must be entered before the search begins.
			keyDelay: 500, //  The delay after a keydown on the doubleSuggest input field and before search is started.
			resultsHighlight: true, // Option to choose whether or not to highlight the matched text in each result item.
			showResultList: true, // If set to false, the Results Dropdown List will never be shown at any time.
			onSelect: function(data){}, // Custom function that is run when an item is added to the items holder.
			formatList: function (data, counter, elem) { return elem.html(data[opts.selectedItemProp]); }, // Custom function that is run after all the data has been retrieved and before the results are put into the suggestion results list. 
			beforeRetrieve: function(string){ return string; }, // Custom function that is run before the AJAX request is made, or the local objected is searched.
			retrieveComplete: function(data, queryString){ return data; },
			resultsComplete: function(){} // Custom function that is run when the suggestion results dropdown list is made visible.
		}; 
		
		// Merge the options passed with the defaults.
		var opts = $.extend(defaults, options);     
		
		return this.each(function(x) {
		
			// Grab the text input and it's id so we can call this plugin multiple times.
			var $input = $(this);
			var	input_id = $input.attr('id');
			$input.attr('autocomplete', 'off').addClass('ds-input').val(opts.startText);
			
			// Global container of the selected items.
			var $dsContainer = $('<div class="ds-container" id="ds-container-'+input_id+'"></div>');
			$input.wrap($dsContainer);
			
			// Div that holds each result or message inside the $resultsUL. 
			var $resultsHolder = $('<div class="as-results" id="as-results-'+input_id+'"></div>').hide();
			$input.after($resultsHolder);
			
			// UL where all search results and messages are placed.
			var $resultsUL = $('<ul class="as-list"></ul>').css('width', $input.outerWidth()).appendTo($resultsHolder);

			// Used internally to know what text was typed by the user
			var typedText = '';
			
			// Get the query limit value.
			var qLimit = opts.queryLimit;

			// Variable that will be holding the remaining time to process the input between each keyup event.
			var timeout = null;

			// Get an array of the properties which the user wants to search with.
			var props = opts.seekVal.split(','); 
			
			// Handle input field events.
			// $input.focus(onInputFocus).keydown(onInputKeyDown).blur(onInputBlur);
			$input.on({
				"focus": function(e) {
					// Remove the startText if we click on the input. 
					if ($input.val() === opts.startText) { $input.val(''); }
					
					// When the input is active, highlight the selections by removing the 'blur' class.
					$("li.as-selection-item", $dsContainer).removeClass('blur');
					
					// Show the results list if there is a value in the input.
					if ($.trim($input.val()) !== '') { $resultsHolder.show(); }	
				},
				"keydown": function(e) {

					// Track last key pressed.
					lastKey = e.keyCode;
					
					switch(lastKey) {
						
						// Up & Down arrow keys pressed.
						case 38: case 40:

							e.preventDefault();
							if (lastKey === 38) spotResult('up'); else spotResult('down');
							break;

						// Delete key pressed.
						case 8:

							// Remove the last char from the input and hide the results list.
							if ($input.val().length === 1){ $resultsHolder.hide(); }

							// Make the search again, after the timeout delay.
							if (timeout){ clearTimeout(timeout); }
							timeout = setTimeout(function(){ keyChange(); }, opts.keyDelay);

							break;

						// Tab or comma keys pressed.
						case 9: case 188: case 13:
						
							var nInput = $.trim($input.val()).replace(/(,)/g, '');
							if (nInput !== '' && nInput.length >= opts.minChars) { 
								
								// If the tab or return keys are pressed when an result item is active, add it.
								// Prevent default behaviour if the comma or return keys are pressed to avoid submiting the form which doubleSuggest is part of.
								if ((lastKey === 9 || lastKey === 13) && $('li.as-result-item:visible', $resultsHolder).length > 0 && $('li.active:first', $resultsUL).length > 0) { 
									$('li.active:first', $resultsUL).trigger('select');
									e.preventDefault();
								} 
								// else { // The tab or return keys where pressed when no results where found.
									
								// 	// If adding new items is allowed.
								// 	if (opts.newItem) {

								// 		// Get the custom formated object from the new item function.
								// 		var nData = opts.newItem.call(this, nInput);

								// 		// Add the new item.
								// 		addItem(nData);

								// 		// Hide the results list.
								// 		$resultsHolder.hide();

								// 		// Reset the text input.
								// 		$input.val('');
								// 	}
								// }
							}	
							break;

						default:

							// Other key was pressed, call the keyChange event after the timeout delay.
							if (timeout) { clearTimeout(timeout); }
							timeout = setTimeout(function(){ keyChange(lastKey); }, opts.keyDelay);
							break;
					}
				},
				"blur": function(e) {
				
					// If no selections where made, show startText again.
					if ($input.val() === ''){ $input.val(opts.startText); }
					
					// If the user is no longer manipulating the results list, hide it.
					if (!($resultsHolder.is(':hover'))){
						$('li.as-selection-item', $dsContainer).addClass('blur').removeClass('selected');
						$resultsHolder.hide();
					}
					
				}
			});

			// Function that is executed when typing and after the key delay timeout.
			function keyChange(lastKey) {

				// ignore if the following keys are pressed: [del] [shift] [capslock]
				if ( lastKey == 46 || (lastKey > 9 && lastKey < 32) ){ return $resultsHolder.hide(); }

				// Get the text from the input.
				// Remove the slashes (\ /) and then the extra whitespaces.
				var string = $.trim($input.val()).replace(/[\\]+|[\/]+/g,"").replace(/\s+/g," ");

				// Save the string to know what was typed by the user.
				typedText = string;

				// If we passed the min chars limit, proceed.
				if (string.length >= opts.minChars) {

					// Call the custom beforeRetrieve function.
					if (opts.beforeRetrieve){ string = opts.beforeRetrieve.call(this, string); }

					// Show the loading text, and start the loading state.
					$input.addClass('loading');
					if(opts.loadingText) { $resultsUL.html('<li class="as-message">'+opts.loadingText+'</li>').show(); }
					$resultsHolder.show();

					// If the data is a URL, build the query and retrieve the response in JSON format.
					if (opts.remoteSource !== '') {
						$.getJSON(opts.remoteSource+"?"+opts.queryParam+"="+encodeURIComponent(string)+opts.extraParams, function(response) { processData(response, string); });
					}
					
					// If the local source is an object, retrieve the results directly from the source.
					if(opts.localSource) {
						processData(opts.localSource, string); 
					}

				} else {
					// We don't have the min chars required. 
					//$input.removeClass('loading');
					$resultsHolder.hide();
				}

			}
			
			// Function that handles the up & down key press events to select the results.
			function spotResult(dir) {

				// If there is at least one visible item in the results list.
				if ($('li.as-result-item:visible', $resultsHolder).length > 0) {
				
					// Get all the LI elements from the results list.
					var lis = $('li', $resultsHolder);

					// If the direction is 'down' spot the first result. If it is 'up', spot the last result.
					var spot = dir === 'down' ? lis.eq(0) : lis.filter(':last');

					// If a LI element was already spoted, take it as the base for future movements.
					var active = $('li.active:first', $resultsHolder);
					if (active.length > 0){ spot = dir === 'down' ? active.next() : active.prev(); }

					// Set the 'active' class to the current result item.
					lis.removeClass('active');
					spot.addClass('active');
					
					// Update the text with the currently selected item
					// Display the text typed by the user if no result is selected
					var newText = spot.length > 0 ? spot.data('data')['attributes'][opts.selectedItemProp] : typedText;
					$input.val(newText);
				}
			}

			// Bind the click event as a way to select results and bind also the mouseover effect on the results list.
			$resultsHolder.on({
				click: function(e){
					$(this).trigger("select");
				},
				mouseover : function(e) {
					// When the mouse is over a suggestion, spot it.
					$('li', $resultsUL).removeClass('active');
					$(this).addClass('active');
				},
				select: function(e) {

					var data = $(this).data();
					
					typedText = data[opts.selectedItemProp];
					opts.onSelect.call(this, data);

					// Clear the input? and hide the results list.
					// $input.val('').focus();
					$resultsHolder.hide();					
				}

			}, ".as-result-item");
			
			// Function that gets the matched results and displays them.
			function processData (data, queryString) {
				
				var data = opts.retrieveComplete.call(this, data, queryString), // This variable will hold the object from the source to be processed. 
					matchCount = 0,
					i = 0;

				// Clean and hide the results container.				  
				$resultsUL.html('');
				$resultsHolder.hide();
			  
				// Loop the data to get an index of each element.
				for (var k in data) {

					if (data.hasOwnProperty(k)) {

						// Build a string for each element, by getting the data of all the properties in seekVal
						str = '';
						for (var y=0; y<props.length; y++) {
							str = str + data[i][$.trim(props[y])];
						}
					
						// If not required, ignore the case sensitive search.
						if (!opts.matchCase) { str = str.toLowerCase(); queryString = queryString.toLowerCase(); }
						
						// If the search returned at least one result, and that result is not already selected.
						if (str.search(queryString) !== -1) {
						  
							// Build each result li element to show on the results list.
							var resultLI = $('<li class="as-result-item" id="as-result-item-'+i+'"></li>').data('data',{attributes: data[i], num: i});
							var resultData = $.extend({}, data[i]);

							// Make the suggestions case sensitive or not. 
							var cType = !opts.matchCase ? 'gi' : 'g';
							var regx = new RegExp('(?![^&;]+;)(?!<[^<>]*)(' + queryString + ')(?![^<>]*>)(?![^&;]+;)', ''+ cType + '');
							
							// Highlight the results if the option is set to true.
							if (opts.resultsHighlight) {
								resultData[opts.selectedItemProp] = resultData[opts.selectedItemProp].replace(regx,"<em>$1</em>");
							}

							// Call the formatList function and add the LI element to the results list.
							$resultsUL.append(opts.formatList.call(this, resultData, matchCount, resultLI));

							// Increment the results counter after each result is added to the results list.
							matchCount++;

							// Check if we reached the limit of results to show.
							if (qLimit && qLimit == matchCount ){ break; }
						}
						
						i++;
					}
				}
	  
				// There results where processed, remove the loading state
				$input.removeClass('loading');
			
				// If no results were found, show the empty text message.
				if (matchCount <= 0 && opts.emptyText){ 
					$resultsUL.html('<li class="as-message">'+opts.emptyText+'</li>'); 
				}

				// Show the results list.
				$resultsHolder.show();

				// Call the custom resultsComplete function.
				opts.resultsComplete.call(this);
			}
		});
	};
})(jQuery);
