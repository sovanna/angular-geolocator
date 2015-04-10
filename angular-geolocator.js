(function (window, angular, undefined) {
    'use strict';

    var swGeolocator = angular.module('sh.$wGeolocator', []);

    swGeolocator.factory('$wGeolocator', [
    	function () {
    		// ---------------------------------------
		    // PRIVATE PROPERTIES & FIELDS
		    // ---------------------------------------

		    var onSuccess,
		        onError,
		        mCanvasId,
		        googleLoaderURL = 'https://www.google.com/jsapi',
		        mapsVersion = '3.18',
		        ipGeoSources = [{
		            url: 'http://freegeoip.net/json/',
		            cbParam: 'callback'
		        }, {
		            url: 'http://www.geoplugin.net/json.gp',
		            cbParam: 'jsoncallback'
		        }, {
		            url: 'http://geoiplookup.wikimedia.org/',
		            cbParam: ''
		        }],
		        defaultSourceIndex = 1,
		        sourceIndex;

		    // ---------------------------------------
		    // PRIVATE METHODS
		    // ---------------------------------------

		    function loadScript(url, callback, removeOnCallback) {
		        var script = document.createElement('script');
		        script.async = true;

		        function execCb(cb, data) {
		            if (removeOnCallback && script.parentNode) {
		                script.parentNode.removeChild(script);
		            }
		            if (typeof cb === 'function') {
		                cb(data);
		            }
		        }

		        if (script.readyState) {
		            script.onreadystatechange = function (e) {
		                if (script.readyState === 'loaded' || script.readyState === 'complete') {
		                    script.onreadystatechange = null;
		                    execCb(callback);
		                }
		            };
		        } else {
		            script.onload = function (e) {
		                execCb(callback);
		            };
		        }

		        script.onerror = function (e) {
		            var errMsg = 'Could not load source at ' + String(url).replace(/\?.*$/, '');
		            execCb(onError, new Error(errMsg));
		        };

		        script.src = url;
		        document.getElementsByTagName('head')[0].appendChild(script);
		    }

		    function loadGoogleMaps(callback) {
		        function loadMaps() {
		            if (geolocator.__glcb) {
		                delete geolocator.__glcb;
		            }
		            google.load('maps', mapsVersion, {
		                other_params: '',
		                callback: callback
		            });
		        }
		        if (window.google !== undefined && google.maps !== undefined) {
		            if (callback) {
		                callback();
		            }
		        } else {
		            if (window.google !== undefined && google.loader !== undefined) {
		                loadMaps();
		            } else {
		                geolocator.__glcb = loadMaps;
		                loadScript(googleLoaderURL + '?callback=geolocator.__glcb');
		            }
		        }
		    }

		    function drawMap(elemId, mapOptions, infoContent) {
		        var map, marker, infowindow,
		            elem = document.getElementById(elemId);
		        if (elem) {
		            map = new google.maps.Map(elem, mapOptions);
		            marker = new google.maps.Marker({
		                position: mapOptions.center,
		                map: map
		            });
		            infowindow = new google.maps.InfoWindow();
		            infowindow.setContent(infoContent);
		            google.maps.event.addListener(marker, 'click', function () {
		                infowindow.open(map, marker);
		            });
		            geolocator.location.map = {
		                canvas: elem,
		                map: map,
		                options: mapOptions,
		                marker: marker,
		                infoWindow: infowindow
		            };
		        } else {
		            geolocator.location.map = null;
		        }
		    }

		    function reverseGeoLookup(latlng, callback) {
		        var geocoder = new google.maps.Geocoder();

		        function onReverseGeo(results, status) {
		            if (status === google.maps.GeocoderStatus.OK) {
		                if (callback) {
		                    callback(results);
		                }
		            }
		        }
		        geocoder.geocode({
		            'latLng': latlng
		        }, onReverseGeo);
		    }

		    function fetchDetailsFromLookup(data) {
		        if (data && data.length > 0) {
		            var i, c, o = {},
		                comps = data[0].address_components;
		            for (i = 0; i < comps.length; i += 1) {
		                c = comps[i];
		                if (c.types && c.types.length > 0) {
		                    o[c.types[0]] = c.long_name;
		                    o[c.types[0] + '_s'] = c.short_name;
		                }
		            }
		            geolocator.location.formattedAddress = data[0].formatted_address;
		            geolocator.location.address = {
		                street: o.route || '',
		                neighborhood: o.neighborhood || '',
		                town: o.sublocality || '',
		                city: o.locality || '',
		                region: o.administrative_area_level_1 || '',
		                country: o.country || '',
		                countryCode: o.country_s || '',
		                postalCode: o.postal_code || '',
		                streetNumber: o.street_number || ''
		            };
		        }
		    }

		    function finalize(coords) {
		        var latlng = new google.maps.LatLng(coords.latitude, coords.longitude);

		        function onGeoLookup(data) {
		            fetchDetailsFromLookup(data);
		            var zoom = geolocator.location.ipGeoSource === null ? 14 : 7, //zoom out if we got the lcoation from IP.
		                mapOptions = {
		                    zoom: zoom,
		                    center: latlng,
		                    mapTypeId: 'roadmap'
		                };
		            drawMap(mCanvasId, mapOptions, data[0].formatted_address);
		            if (onSuccess) {
		                onSuccess.call(null, geolocator.location);
		            }
		        }
		        reverseGeoLookup(latlng, onGeoLookup);
		    }

		    function getPosition(fallbackToIP, html5Options) {
		        geolocator.location = null;

		        function fallback(error) {
		            var ipsIndex = fallbackToIP === true ? 0 : (typeof fallbackToIP === 'number' ? fallbackToIP : -1);
		            if (ipsIndex >= 0) {
		                geolocator.locateByIP(onSuccess, onError, ipsIndex, mCanvasId);
		            } else {
		                if (onError) {
		                    onError(error);
		                }
		            }
		        }

		        function geoSuccess(position) {
		            geolocator.location = {
		                ipGeoSource: null,
		                coords: position.coords,
		                timestamp: (new Date()).getTime()
		            };
		            finalize(geolocator.location.coords);
		        }

		        function geoError(error) {
		            fallback(error);
		        }

		        if (navigator.geolocation) {
		            navigator.geolocation.getCurrentPosition(geoSuccess, geoError, html5Options);
		        } else {
		            fallback(new Error('geolocation is not supported.'));
		        }
		    }

		    function buildLocation(ipSourceIndex, data) {
		        switch (ipSourceIndex) {
		            case 0: // freegeoip
		                geolocator.location = {
		                    coords: {
		                        latitude: data.latitude,
		                        longitude: data.longitude
		                    },
		                    address: {
		                        city: data.city,
		                        country: data.country_name,
		                        countryCode: data.country_code,
		                        region: data.region_name
		                    }
		                };
		                break;
		            case 1: // geoplugin
		                geolocator.location = {
		                    coords: {
		                        latitude: data.geoplugin_latitude,
		                        longitude: data.geoplugin_longitude
		                    },
		                    address: {
		                        city: data.geoplugin_city,
		                        country: data.geoplugin_countryName,
		                        countryCode: data.geoplugin_countryCode,
		                        region: data.geoplugin_regionName
		                    }
		                };
		                break;
		            case 2: // Wikimedia
		                geolocator.location = {
		                    coords: {
		                        latitude: data.lat,
		                        longitude: data.lon
		                    },
		                    address: {
		                        city: data.city,
		                        country: '',
		                        countryCode: data.country,
		                        region: ''
		                    }
		                };
		                break;
		        }
		        if (geolocator.location) {
		            geolocator.location.coords.accuracy = null;
		            geolocator.location.coords.altitude = null;
		            geolocator.location.coords.altitudeAccuracy = null;
		            geolocator.location.coords.heading = null;
		            geolocator.location.coords.speed = null;
		            geolocator.location.timestamp = new Date().getTime();
		            geolocator.location.ipGeoSource = ipGeoSources[ipSourceIndex];
		            geolocator.location.ipGeoSource.data = data;
		        }
		    }

		    function onGeoSourceCallback(data) {
		        var initialized = false;
		        geolocator.location = null;
		        delete geolocator.__ipscb;

		        function gLoadCallback() {
		            if (sourceIndex === 2) { // Wikimedia
		                if (window.Geo !== undefined) {
		                    buildLocation(sourceIndex, window.Geo);
		                    delete window.Geo;
		                    initialized = true;
		                }
		            } else {
		                if (data !== undefined && typeof data !== 'string') {
		                    buildLocation(sourceIndex, data);
		                    initialized = true;
		                }
		            }

		            if (initialized === true) {
		                finalize(geolocator.location.coords);
		            } else {
		                if (onError) {
		                    onError(new Error(data || 'Could not get location.'));
		                }
		            }
		        }

		        loadGoogleMaps(gLoadCallback);
		    }

		    function loadIpGeoSource(source) {
		        if (source.cbParam === undefined || source.cbParam === null || source.cbParam === '') {
		            loadScript(source.url, onGeoSourceCallback, true);
		        } else {
		            loadScript(source.url + '?' + source.cbParam + '=geolocator.__ipscb', undefined, true); //ip source callback
		        }
		    }

		    return {

		        // ---------------------------------------
		        // PUBLIC PROPERTIES
		        // ---------------------------------------

		        /** The recent location information fetched as an object.
		         */
		        location: null,

		        // ---------------------------------------
		        // PUBLIC METHODS
		        // ---------------------------------------

		        /** Gets the geo-location by requesting user's permission.
		         */
		        locate: function (successCallback, errorCallback, fallbackToIP, html5Options, mapCanvasId) {
		            onSuccess = successCallback;
		            onError = errorCallback;
		            mCanvasId = mapCanvasId;

		            function gLoadCallback() {
		                getPosition(fallbackToIP, html5Options);
		            }
		            loadGoogleMaps(gLoadCallback);
		        },

		        /** Gets the geo-location from the user's IP.
		         */
		        locateByIP: function (successCallback, errorCallback, ipSourceIndex, mapCanvasId) {
		            sourceIndex = (typeof ipSourceIndex !== 'number' ||
		                (ipSourceIndex < 0 || ipSourceIndex >= ipGeoSources.length)) ? defaultSourceIndex : ipSourceIndex;
		            onSuccess = successCallback;
		            onError = errorCallback;
		            mCanvasId = mapCanvasId;
		            geolocator.__ipscb = onGeoSourceCallback;
		            loadIpGeoSource(ipGeoSources[sourceIndex]);
		        },

		        /** Checks whether the type of the given object is HTML5
		         *  `PositionError` and returns a `Boolean` value.
		         */
		        isPositionError: function (error) {
		            return Object.prototype.toString.call(error) === '[object PositionError]';
		        }
		    };
    	}
    ]);
})(window, window.angular);
