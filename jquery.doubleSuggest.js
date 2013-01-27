/*
 * doubleSuggest
 *
 * @Version: 0.3
 * @Author: hernantz 
 * @Url: http://www.github.to/hernantz/doubleSuggest
 * @License: MIT - http://www.opensource.org/licenses/mit-license.php
 *
 * This jQuery plugin will set up a UI that suggest results as you type. 
 * It will display two types of suggestions, first (and faster) the local data 
 * and also the results from an ajax search query. 
 * Requires jQuery > v.1.7
 */

;(function($) {

	var methods = {
		init: function (options) {

			// Iterate over the current set of matched elements.
			return this.each(function(index, element) {

				// Merge the options passed with the defaultOptions.
				var opts = $.extend({}, $.fn.doubleSuggest.defaultOptions, options);

				// Grab the text input and it's id so we can call this plugin multiple times.
				var $input = $(this).addClass('ds-input');
				var	input_id = $input.attr('id');

				// Global container of the selected items.
				var $dsContainer = $('<div class="ds-container" id="ds-container-'+input_id+'"></div>');
				$input.wrap($dsContainer);

				// Div that holds each result or message inside the $resultsUL. 
				var $resultsHolder = $('<div class="ds-results" id="ds-results-'+input_id+'"></div>').hide();
				$input.after($resultsHolder);

				// UL where all search results and messages are placed.
				var $resultsUL = $('<ul class="ds-list"></ul>').css('width', $input.outerWidth()).appendTo($resultsHolder);

				// Used internally to know what text was typed by the user
				var currentValue = $.trim($input.val());

				// Variable that will be holding the remaining time to process the input between each keyup event.
				var timeout = null;

				// Variable that holds the XMLHTTPRequest object. 
				var jqxhr = null;

				// Handle input field events.
				$input.on({
					"focus.doubleSuggest": function(e) {
						// Show the results list if there is a value in the input.
						if ($.trim($input.val()) !== '') { $resultsHolder.show(); }	
					},
					"keydown.doubleSuggest": function(e) {

						// Track last key pressed.
						var lastKey = e.keyCode;
						
						switch(lastKey) {
							
							// Up & Down arrow keys pressed.
							case 38: case 40:

								e.preventDefault();
								if (lastKey === 38) { spotResult('up'); } else { spotResult('down'); }
								break;

							// Delete key pressed.
							case 8:

								// Remove the last char from the input and hide the results list.
								if ($input.val().length === 1){ $resultsHolder.hide(); }

								// Make the search again, after the timeout delay.
								refreshSearch();
								break;

							// Tab or Enter keys pressed.
							case 9: case 13:

								var nInput = $.trim($input.val());
								if (nInput !== '' && nInput.length >= opts.minChars) { 
									
									// Prevent default behaviour if the Tab or Enter keys are pressed to avoid submiting the form which doubleSuggest is part of.
									if ($('li.ds-result-item:visible', $resultsHolder).length > 0 && $('li.active:first', $resultsUL).length > 0) {
										$('li.active:first', $resultsUL).trigger('select');
										e.preventDefault();
									}
                                    // FIXME: implement this feature? 
									/*else { // The tab or return keys where pressed when no results where found.
										
										// If adding new items is allowed.
										if (opts.newItem) {

											// Get the custom formated object from the new item function.
											var nData = opts.newItem.call(this, nInput);

											// Hide the results list.
											$resultsHolder.hide();

											// Reset the text input.
											$input.val('');
										}
									}*/
								}	
								break;

							// Esc key pressed.
							case 27:
								clearAjaxRequest();
								$resultsHolder.hide();
								break;

							default:

								// Ignore if the following keys are pressed: [shift] [capslock]
								if ( lastKey === 46 || (lastKey > 9 && lastKey < 32) ) { 
									$resultsHolder.hide(); 
								} else {
									// Other key was pressed, call the keyChange event after the timeout delay.
									refreshSearch();
								}
								break;
						}
					},
					"blur.doubleSuggest": function(e) {

						// If the user is no longer manipulating the results list, hide it.
						if (!($resultsHolder.is(':hover'))){
							$input.val(currentValue);
							$resultsHolder.hide();
						}
					},
					"refresh.doubleSuggest": function(e, newValue) {
                        // Used to programatically performs a new search.
                        refreshSearch();
                    },
					"setValue.doubleSuggest": function(e, newValue) {
                        // Used to programatically update the input's value,
                        // when interacting with other js scripts.
                        currentValue = newValue;
                        $input.val(newValue);
                    },
					"updateOptions.doubleSuggest": function(e, newOptions) {
						// Refresh the options.
						opts = $.extend($.fn.doubleSuggest.defaultOptions, options, newOptions);
					}, 
					"destroy.doubleSuggest": function(e) {
						$resultsHolder.remove();
						$input.val('').removeClass('ds-input').unbind('.doubleSuggest').unwrap();
					}
				});

				// Aborts the previous ajax request if it exists.
				function clearAjaxRequest() {
					if (jqxhr) { jqxhr.abort(); }
				}

				// Performs a new search by calling the keyChange function after the delay set.
				function refreshSearch() {
					if (timeout) { clearTimeout(timeout); }
					timeout = setTimeout(keyChange, opts.keyDelay);
				}

				// Function that is executed when typing and after the key delay timeout.
				function keyChange() {

					// Get the text from the input.
					// Remove the slashes "\" & "/" and then the extra whitespaces.
					var string = $.trim($input.val()).replace(/[\\]+|[\/]+/g,"").replace(/\s+/g," ");

					// Save the string to know what was typed by the user.
					currentValue = string;

					// If we passed the min chars limit, proceed.
					if (string.length >= opts.minChars) {

						// Call the custom beforeRetrieve function.
						if (opts.beforeRetrieve){ string = opts.beforeRetrieve.call(this, string); }

						// Show the loading text, and start the loading state.
						$input.addClass('loading');
						if(opts.loadingText) { $resultsUL.html('<li class="ds-message">'+opts.loadingText+'</li>').show(); } 
						$resultsHolder.show();

						// If the data is a URL, build the query and retrieve the response in JSON format.
						if (opts.remoteSource) {
							clearAjaxRequest();
							var queryParam = {};
							queryParam[opts.queryParam] = string;
							jqxhr = $.getJSON(opts.remoteSource, $.extend({}, queryParam, opts.extraParams), function(response) { processData(response, string, false); });
						}

						// If the local source is an object, retrieve the results directly from the source.
						if(opts.localSource) {
							processData(opts.localSource, string, true); 
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
					if ($('li.ds-result-item:visible', $resultsHolder).length > 0) {

						// Get all the LI elements from the results list.
						var $lis = $('li', $resultsHolder);

						// If the direction is 'down' spot the first result. If it is 'up', spot the last result.
						var $spot = dir === 'down' ? $lis.eq(0) : $lis.filter(':last');

						// If a LI element was already spoted, take it as the base for future movements.
						var $active = $('li.active:first', $resultsHolder);
						if ($active.length > 0){ $spot = dir === 'down' ? $active.next() : $active.prev(); }

						// Set the 'active' class to the current result item.
						$lis.removeClass('active');
						$spot.addClass('active');

						// Call the custom onResultFocus function.
						if ($spot.length > 0) { opts.onResultFocus.call($input, $spot.data()); }

						// Update the text with the currently selected item
						// Display the text typed by the user if no result is selected
						var newText = $spot.length > 0 ? $spot.data()[opts.selectValue] : currentValue;
						$input.val(newText);
					}
				}

				// Bind the click event as a way to select results and bind also the mouseover effect on the results list.
				$resultsHolder.on({
					click: function(e){
						$(this).trigger("select");
					},
					mouseover: function(e) {
						// When the mouse is over a suggestion, spot it.
						$('li', $resultsUL).removeClass('active');
						$(this).addClass('active');

						// Call the custom onResultFocus function.
						opts.onResultFocus.call($input, $(this).data());
					},
					select: function(e) {

						var $elem = $(this);
						var data = $elem.data();
						currentValue = data[opts.selectValue];
						$input.val(currentValue);

						opts.onSelect.call($input, data, $elem);
						$resultsUL.html('');
						$resultsHolder.hide();			
					}
				}, ".ds-result-item");
				
				// Function that gets the matched results and displays them.
				function processData (data, queryString, isLocal) {

					var data = opts.retrieveComplete.call(this, data, queryString, isLocal), // This variable will hold the object from the source to be processed. 
						props = opts.seekValue.split(','), // Get an array of the properties which the user wants to search with.
						matchCount = 0,
						i = 0;

					// Clean and hide the results container, this is to remove older results and the loading message.
					// Local results will appear faster and remove the loading message, but in case local results are disabled,
					// the clean up show be done anyways.
					if (isLocal || !opts.localSource) {
						$resultsUL.html('');
						$resultsHolder.hide();
					} 

					// Loop the data to get an index of each element.
					for (var k in data) {

						if (data.hasOwnProperty(k)) {

							// Build a string for each element, by getting the data of all the properties in seekValue
							var str = '';
							for (var y=0; y<props.length; y++) {
								str = str + (data[i][$.trim(props[y])] !== undefined ? data[i][$.trim(props[y])] : '');
							}

							// If not required, ignore the case sensitive search.
							if (!opts.matchCase) { 
								str = str.toLowerCase(); 
								queryString = queryString.toLowerCase(); 
							}

							// Get an array of words the user typed
							var queryWords = queryString.split(' ');

							// Check if the query matches any word from the source
							var matched = false;
							for (var w in queryWords) {
								if (queryWords.hasOwnProperty(w)) {
									if(str.search(queryWords[w]) !== -1){
										matched = true;
									}
								}
							}

							// If the search returned at least one result.
							if (matched === true) {
								// Set a flag for each data source, and also attach the element's position
								data[i]['_dataSource'] = isLocal ? 'local' : 'remote';
								data[i]['_number'] = matchCount;

								// Build each result li element to show on the results list.
								var resultLI = $('<li class="ds-result-item" id="ds-result-item-'+i+'"></li>').data(data[i]);
								var resultData = $.extend({}, data[i]);

								// Highlight matched words if the option is set to true.
								if (opts.resultsHighlight) {
									for (var w in queryWords) {
										if (queryWords.hasOwnProperty(w)) {

											// Make the suggestions case sensitive or not. 
											var cType = !opts.matchCase ? 'gi' : 'g';
											var regx = new RegExp('(?![^&;]+;)(?!<[^<>]*)(' + queryWords[w] + ')(?![^<>]*>)(?![^&;]+;)', ''+ cType + '');
											
											// Highlight the results 
											resultData[opts.selectValue] = resultData[opts.selectValue].replace(regx,"<em>$1</em>");
										}
									}
								}

								// Call the formatList function and add the LI element to the results list.
								var $elem = opts.formatList ? opts.formatList.call($input, resultData, resultLI) : resultLI.html(resultData[opts.selectValue]);
								$resultsUL.append($elem);

								// Increment the results counter after each result is added to the results list.
								matchCount++;

								// Check if we reached the limit of results to show.
								if (opts.queryLimit && opts.queryLimit === matchCount ){ break; }
							}

							i++;
						}
					}

					// There results where processed, remove the loading state
					$input.removeClass('loading');
				
					// If no results were found, show the empty text message.
					if (matchCount <= 0 && opts.emptyText){ 
						$resultsUL.html('<li class="ds-message">'+opts.emptyText+'</li>'); 
					}

					// Show the results list.
					$resultsHolder.show();

					// Call the custom resultsComplete function.
					opts.resultsComplete.call(this);
				}
			});
		},
		refresh: function() {
			return this.each(function(index, element) {
				$(this).trigger("refresh");
			});
		},
		setValue: function(value) {
			return this.each(function(index, element) {
				$(this).trigger("setValue", value);
			});
		},
		update: function(options) {
			return this.each(function(index, element) {
				$(this).trigger("updateOptions", options);
			});
		},
		destroy: function() {
			return this.each(function(index, element) {
				$(this).trigger("destroy");
			});
		}
	};

	$.fn.doubleSuggest = function(args) {
		if ( methods[args] ) {
			return methods[args].apply(this, Array.prototype.slice.call(arguments, 1));
		} else if (typeof args === 'object' || !args) {
			return methods.init.apply(this, arguments);
		} else {
			$.error('Invalid arguments ' + args + ' on jQuery.doubleSuggest');
		}
	};

	// Make the defaultOptions globally accessable.
	$.fn.doubleSuggest.defaultOptions = {
		localSource: false, // List of objects where doubleSuggest gets the suggestions from.
		remoteSource: false, // URL where doubleSuggest gets the suggestions from.
		emptyText: false, // Text to display when their are no search results.
		loadingText: 'Loading...', // Text to display when the results are being retrieved.
		newItem: false, // If set to false, the user will not be able to add new items by any other way than by selecting from the suggestions list.
		selectValue: 'name', // Name of object property passed as data source to doubleSuggest that is going to be displayed in the results list.
		seekValue: 'name', // Comma separated list of object property names.
		queryParam: 'q', // The name of the param that will hold the search string value in the AJAX request.
		queryLimit: false, // Number for 'limit' param on ajax request.
		extraParams: {}, // Key - value object to pass along with the ajax request.
		matchCase: false, // Make the search case sensitive when set to true.
		minChars: 1, // Minimum number of characters that must be entered before the search begins.
		keyDelay: 500, // The delay after a keydown on the input field triggers a new search.
		resultsHighlight: true, // Option to choose whether or not to highlight the matched text in each result item.
		onSelect: function(data){}, // Custom function that is run when a result is selected with a mouse click or enter / tab key press.
		onResultFocus: function(data){}, // Custom function that is run when a result is focused on mouse over / up - down key navigation.
		formatList: false, // Custom function that is run after all the data has been retrieved and before the results are put into the suggestion results list.
		beforeRetrieve: function(string){ return string; }, // Custom function that is run before the AJAX request is made, or the local object is searched.
		retrieveComplete: function(data, queryString, isLocal){ return data; }, // Custom function that is run before the current data object is processed.
		resultsComplete: function(){} // Custom function that is run when the suggestion results dropdown list is made visible.
	};
})(jQuery);
