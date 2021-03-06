var lastRequestTime = 0;
var requestInterval = 50;

var timeoutHistory = [];
var xhrHistory = [];

function get(url, done) {
	var xhr = new XMLHttpRequest();
	xhrHistory.push(xhr);
	xhr.open('GET', url, true);
	xhr.onreadystatechange = function (e) {
		if (xhr.readyState == 4) {
			done(xhr.responseText);
		}
	}
	var delay = Math.max(lastRequestTime + requestInterval - (+new Date()), 0) + Math.random() * requestInterval;
	lastRequestTime = delay + (+new Date());
	timeoutHistory.push(setTimeout(function () {
		xhr.send();
	}, delay));
}

function getNewsFeedFrequency(maxDepth, done, onFetch) {
	var frequency = {};

	function fetch(url, depth, fetchDone) {
		console.log('getNewsFeedFrequency.fetch', depth);
		get(url, function (text) {
			var $t = $(text);

			// MARK
			var links = $t.find('[role="article"] a').map(function () {
				return /(.*?)(?:\/\?|\?|$)/.exec($(this).attr('href'))[1];
			}).get();
			links.forEach(function (link) {
				if (!frequency.hasOwnProperty(link)) frequency[link] = 0;
				frequency[link]++;
			});

			onFetch();

			// MARK
			var next = $t.find('a[href^="/stories.php?aftercursorr"]').last().attr('href');
			if (next && depth) {
				fetch('https://mbasic.facebook.com' + next, depth - 1, fetchDone);
			} else {
				fetchDone();
			}
		});
	}

	fetch('https://mbasic.facebook.com/stories.php', maxDepth, function () {
		done(frequency);
	});
}

function getPageLikes(pageId, done, onFetch) {
	console.log('getPageLikes', pageId);
	get('https://mbasic.facebook.com/profile.php?id=' + pageId, function (text) {
		var $t = $(text);
		// MARK
		var url2 = 'https://mbasic.facebook.com' + $t.find('a[href$="about?refid=17"]').attr('href');
		url2 = url2.replace(/about\?refid=17/, 'socialcontext');
		onFetch();

		get(url2, function (text2) {
			var $t = $(text2);
			// MARK
			var profileUrls = $t.find('h4:contains("Friends who like this ")').siblings().find('a').map(function () {
				return {
					href: $(this).attr('href'),
					name: $(this).text(),
				};
			}).get();
			onFetch();
			done(profileUrls);
		});
	});
}

function getFriendIds(maxDepth, done) {
	var friends = [];

	function fetch(url, depth, fetchDone) {
		console.log('getFriendIds.fetch', depth);

		get(url, function (text) {
			var $t = $(text);

			var profileUrls = $t.find('a').map(function() {
				const link = $(this).attr('href');
				if (link !== undefined && link.indexOf("fr_tab") > -1) {
					return {
						href: link,
						name: $(this).text(),
					}
				}
			}).get();

			friends = friends.concat(profileUrls);

			var next = $t.find('a[href*="/friends?unit_cursor"]').last().attr('href');
			if (next && depth) {
				fetch('https://mbasic.facebook.com' + next, depth - 1, fetchDone);
			} else {
				fetchDone();
			}
		});
	}

	fetch('https://mbasic.facebook.com/me/friends', maxDepth, function () {
		done(friends);
	});
}

function getReligions(friendData, done) {
	var religionData = [];
	console.log("There are " + friendData.length.toString() + " friends");
	// andrew code
	
	// 	const promise = Promise.resolve(get(url)).then(function (text) {
	// 	var $t = $(text);
	// 	var religion = $t.find("div[title=\"Religious Views\"]");
	// 	if(religion) {
	// 		religion = religion.contents().filter(function() { 
	// 			return !!$.trim( this.innerHTML || this.data ); 
	// 		}).first().text().replace('Religious Views','');
	// 		if(religion.length > 0) {
	// 			religionData.push(religion);
	// 		}
	// 		console.log(religionData);
	// 	}
	// })


	// return Promise.all(friendData.map(function(friend) {
	// 	var url = 'https://mbasic.facebook.com' + friend.href.replace("?", "/about?");
	// 	return Promise.resolve(get(url)).then(function (text) {
	// 		var $t = $(text);
	// 		var religion = $t.find("div[title=\"Religious Views\"]");
	// 		if(religion) {
	// 			religion = religion.contents().filter(function() { 
	// 				return !!$.trim( this.innerHTML || this.data ); 
	// 			}).first().text().replace('Religious Views','');
	// 			if(religion.length > 0) {
	// 				religionData.push(religion);
	// 			}
	// 			console.log(religionData);
	// 		}
	// 	})
	// })).then(function(religionData) {
	// 	console.log(religionData)
	// 	console.log('done with promise.all')
	// })

	for(var i = 0; i < friendData.length; i++) {
		var friend = friendData[i];
		var url = 'https://mbasic.facebook.com' + friend.href.replace("?", "/about?");
		get(url, function (text) {
			var $t = $(text);
			var religion = $t.find("div[title=\"Religious Views\"]");
			if(religion) {
				religion = religion.contents().filter(function() { 
					return !!$.trim( this.innerHTML || this.data ); 
				}).first().text().replace('Religious Views','');
				if(religion.length > 0) {
					religionData.push(religion);
				}
				console.log(religionData);
			}
		});
	}
	setTimeout(function() {
		console.log("timeout done", religionData);
		chrome.storage.sync.set({"value": religionData}, function() {
			console.log('Religion Data saved');
		  });
		done(religionData);
	}, 6000);
}

function getAllFriendScores2(done, progress) {
	var maxNewsFeedDepth = 20;

	var pageIds = getAllPageIds();
	var profileToPages = {};
	var profileToName = {};
	var profileToFrequency;
	pageIds.forEach(function (pageId) {
		getPageLikes(pageId, function (profiles) {
			profiles.forEach(function (profile) {
				if (!profileToPages.hasOwnProperty(profile.href)) profileToPages[profile.href] = [];
				profileToPages[profile.href].push(pageId);

				if (!profileToName.hasOwnProperty(profile.href)) profileToName[profile.href] = profile.name;
			});
			onReturn();
		}, onProgress);
	});
	getNewsFeedFrequency(maxNewsFeedDepth, function (data, progress) {
		profileToFrequency = data;
		onReturn();
	}, onProgress);

	var totalProgress = maxNewsFeedDepth + 2 * pageIds.length;
	var elapsedProgress = 0;

	function onProgress() {
		elapsedProgress++;
		progress && progress(elapsedProgress, totalProgress);
	}

	var numReturnsRemaining = 1 + pageIds.length;

	function onReturn() {
		numReturnsRemaining--;
		if (numReturnsRemaining == 0) {
			var results = Object.keys(profileToPages).map(function (profile) {
				var scores = score(profileToPages[profile]);
				// var religion_scores = religionScore(profileToPages[profile])
				// console.log("[wlong] religion_scores: ", religion_scores)
				return {
					userId: profile,
					name: profileToName[profile],
					frequency: profileToFrequency[profile] || 0,
					score: scores.politicalScore,
					//frequency: scores.frequency, 
					//authenticity: scores.authenticity 
					confidence: scores.confidence,
					pages: scores.pages
				}
			});
			// console.log(Object.keys(profileToFrequency).filter(function (profile) { return !profileToPages.hasOwnProperty(profile); }).join(","));
			done(results);
		}
	}
}

function buildQueryUrl(userId, newsSourceIds) {
	var url = 'https://www.facebook.com/search';
	for (var i = 0; i < newsSourceIds.length; i++) {
		url += '/' + newsSourceIds[i] + '/stories-by';
		if (i > 0) {
			url += '/union/intersect';
		}
	}
	url += '/' + userId + '/stories-liked/intersect';
	return url;
}

function getAllPageIds() {
	return Object.keys(news_dict)
		.concat(Object.keys(fakenews_dict))
		.concat(Object.keys(pol_dict));
}

function getAllReligionPageIds() {
	return Object.keys(religion_dict);
}

function getLoggedInAs(done) {
	get('https://mbasic.facebook.com', function(text) {
		var $t = $(text);

		// MARK
		var pr = $t.find('a:contains("Profile")');
		if (pr.length === 0) {
			return done(null);
		}
		else {
			var href = pr.attr('href');
			return done(href.substring(0, href.indexOf('?')));
		}
	});
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (request.action == "parse") {
		var userData = request.cached;
		var religions = [];

		getFriendIds(4, function(profileUrls) {
			getReligions(profileUrls, function(religionData) {
				religions = religionData;
				religions.map(function(religion) {
					if((religion.toLowerCase().includes("jew")) ||
						religion.toLowerCase().includes("jud")) {
						return "Jewish";
					}
					else if((religion.toLowerCase().includes("christ")) || 
							(religion.toLowerCase().includes("jesus")) ||
							(religion.toLowerCase().includes("catholic")) || 
							religion.toLowerCase().includes("church")) {
								return "Christian";
							}
					else if(religion.toLowerCase().includes("islam") ||
							religion.toLowerCase().includes("muslim")) {
								return "Muslim";
							}
					else if(religion.toLowerCase().includes("hindu")) {
						return "Hindu";
					}
					else if(religion.toLowerCase().includes("bud")) {
						return "Buddhism";
					}
					else if(religion.toLowerCase().includes("J")) {
						return "Hindu";
					}
					else {
						return "Other";
					}
				})
				setTimeout(function() {
					console.log("Religion data finished", religions);	
				}, 7000);
			})
		})

		getLoggedInAs(function(login) {
			if (!login) {
				// not logged in
				chrome.runtime.sendMessage({
					action: "parseResponse",
					data: [],
					login: null,
					tab: sender.tab.id
				});
			}
			else if (userData && userData["login"] && userData["time"] &&
					login == userData["login"] &&
					(new Date - new Date(parseInt(userData["time"]))) / 1000 / 60 < 30) {
				// cached data is valid
				// getAllFriendIds();
				chrome.runtime.sendMessage({
					action: "parseResponse",
					data: userData["data"],
					login: userData["login"],
					tab: sender.tab.id
				});
			}
			else {
				// cached data is invalid
				getAllFriendScores2(function (data) {
					console.log(data);
					chrome.runtime.sendMessage({
						action: "parseResponse",
						data: data,
						login: login,
						tab: sender.tab.id
					});
				}, function (elapsed, total) {
					// console.log('Progress: ' + elapsed + '/' + total);
					chrome.runtime.sendMessage({
						action: "parseProgress",
						data: {
							elapsed: elapsed,
							total: total,
						},
					});
				});
			}
		});
	} else if (request.action == 'reset') {
		timeoutHistory.forEach(function (timeout) {
			clearTimeout(timeout)
		});
		timeoutHistory = [];
		
		xhrHistory.forEach(function (xhr) {
			// http://stackoverflow.com/a/28257394/133211
			xhr.onreadystatechange = null;
			xhr.abort();
		});
		xhrHistory = [];
	}
});