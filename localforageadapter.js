/**
 * author: Jason Thomas
 * Adapting localstorage driver to use localforage instead.
 */

// This function will test localforage to see if its actually available and
// working.
var _getLocalForage = function () {

    // Set Forage to localForage - if test fails Forage is set to null
    var storage = localForage;

    return storage;
};

// Get storage if available
var _storage = _getLocalForage();


// Check to see if we got any localForage to add
if (_storage) {

    // Create a namespace to track storage name spacing
    var _localForageNS = {};

    // Create a noop function
    var noop = function () {
    };

    // Prefix convention
    var _prefix = function (name) {
        return '_storage.' + name;
    };

    // Prefix database
    var _prefixDatabase = function (name) {
        return _prefix(name) + '.db.';
    };

    // Prefix database record
    var _prefixDatabaseRecord = function (name) {
        return _prefix(name) + '.record';
    };

    // Helper getting and updating the table record
    var _setTableRecord = function (SAInstance, migrationCallback) {

        // Database record name in localForage
        var recordName = _prefixDatabaseRecord(SAInstance.name);

        // Get the database record
        var oldRecordString = _storage.getItem(recordName);

        // Set the default empty record object
        var record = {};

        try {

            // Get old record object
            record = oldRecordString && EJSON.parse(oldRecordString) || {};

        } catch (err) {
            // Noop, cant do much about it, we assume that data is lost
        }

        // Set new version helper
        var newVersion = SAInstance.version;

        // Set old version helper
        var oldVersion = record.version || 1.0;

        // Update the record
        record.version = SAInstance.version;

        try {

            // Create new record as string
            var newRecordString = EJSON.stringify(record);

            // Store the new record
            _storage.setItem(recordName, newRecordString);

        } catch (err) {
            // Noop, cant do much here
        }

        migrationCallback.call(SAInstance, {
            version: oldVersion
        }, {
            version: newVersion
        });
    };

    // Yeah, got it - add the api to the Storage global
    Store.localForage = function (options) {
        var self = this;

        if (!(self instanceof Store.localForage)) {
            return new Store.localForage(self.name);
        }

        // Inheritance EventEmitter
        self.eventemitter = new EventEmitter();

        // Make sure options is at least an empty object
        options = options || {};

        // Set the name on the instance
        self.name = options.name;

        // Check to see if the Forage is already defined
        if (_localForageNS[self.name]) {
            throw new Error('Forage.localForage "' + self.name + '" is already in use');
        }

        // Make sure that the user dont use '.db.'
        if (/\.db\./.test(self.name)) {
            throw new Error('Storage.localForage "' + self.name + '" contains ".db." this is not allowed');
        }

        // Set the size of db 0 === disable quota
        // TODO: Implement
        self.size = options.size || 0;

        // Set version - if this is bumped then the data is cleared pr. default
        // migration
        self.version = options.version || 1.0;

        // Set migration function
        var migrationFunction = options.migration || function (oldRecord, newRecord) {

                // Check storage versions
                if (oldRecord.version !== newRecord.version) {
                    // We allow the user to customize a migration algoritme but here we just
                    // clear the Forage if versions mismatch
                    self.clear(noop);
                }
            };

        // Store the instance
        _localForageNS[self.name] = self;


        // Set the table record, at the moment this is only handling the version
        _setTableRecord(self, migrationFunction);

    };

    // Simple helper to return the storage type name
    Store.localForage.prototype.typeName = function () {
        return 'localForage';
    };

    Store.localForage.prototype.prefix = function () {
        var self = this;
        return _prefixDatabase(self.name);
    };

    Store.localForage.prototype.getPrefixedId = function (name) {
        var self = this;
        return self.prefix() + name;
    };

    //////////////////////////////////////////////////////////////////////////////
    // WRAP LOCALForage API
    //////////////////////////////////////////////////////////////////////////////

    Store.localForage.prototype.getItem = function (name, callback) {
        var self = this;

        // Check if callback is function
        if (typeof callback !== 'function') {
            throw new Error('Storage.localForage.getItem require a callback function');
        }

        try {

            // Get the string value
            _storage.getItem(self.getPrefixedId(name), function (result, error) {
                callback(result && EJSON.parse(result), error);
            });

            // Try to return the object of the parsed string
            //callback(null, jsonObj && EJSON.parse(jsonObj) || jsonObj);

        } catch (err) {
            // Callback with error
            callback(null, err);

        }

    };

    Store.localForage.prototype.setItem = function (name, obj, callback) {
        var self = this;

        // Check if callback is function
        if (typeof callback !== 'function') {
            throw new Error('Storage.localForage.setItem require a callback function');
        }

        try {

            // Stringify the object
            var jsonObj = EJSON.stringify(obj);

            // Try to set the stringified object
            _storage.setItem(self.getPrefixedId(name), jsonObj, callback);

        } catch (err) {

            // Callback with error
            callback(null, err);

        }
    };

    Store.localForage.prototype.removeItem = function (name, callback) {
        var self = this;

        // Check if callback is function
        if (typeof callback !== 'function') {
            throw new Error('Storage.localForage.removeItem require a callback function');
        }

        try {

            // Try to remove the item
            _storage.removeItem(self.getPrefixedId(name), callback);
        } catch (err) {

            // callback with error
            callback(null, err);

        }
    };

    Store.localForage.prototype.clear = function (callback) {
        var self = this;

        // Check if callback is function
        if (typeof callback !== 'function') {
            throw new Error('Storage.localForage.clear require a callback function');
        }

        try {

            // Find all relevant keys for this Forage
            self.keys(function (keys, err) {
                if (err) {

                    // On error we just callback
                    callback(null, err);

                } else {

                    // Iterate over keys and removing them one by one
                    for ( var i = 0; i < keys.length; i++ ) {
                        self.removeItem(keys[i], noop);
                    }

                    // Callback
                    callback(keys.length, null);
                }
            });

        } catch (err) {

            // callback with error
            callback(null, err);

        }
    };

    Store.localForage.prototype.keys = function (callback) {
        var self = this;

        // Check if callback is function
        if (typeof callback !== 'function') {
            throw new Error('Storage.localForage.keys require a callback function');
        }

        // Result to return
        var result = [];

        try {
            // Create the prefix test
            var regex = new RegExp('^' + self.prefix());

            _storage.keys(function (result, error) {
                if(error) {
                    callback(null, error);
                }
                else {
                    result = _.collect(_.select(result, function (nextKey) {
                        if (regex.test(nextKey)) {
                            // Add the name
                            return true;
                        }
                        return false;
                    }), function (nextKey) {
                        return nextKey.replace(regex, '');
                    });

                    callback(result, null);
                }
            });
        }
        catch
            (err) {

            // callback with error
            callback(null, err);

        }
    }

    Store.localForage.prototype.length = function (callback) {
        var self = this;

        // Check if callback is function
        if (typeof callback !== 'function') {
            throw new Error('Storage.localForage.length require a callback function');
        }

        try {

            // Get the keys
            self.keys(function (keys, error) {
                // Return the length
                callback(keys && keys.length || null, error);

            });

        } catch (err) {

            // callback with error
            callback(null, err);

        }
    };

    Store.localForage.prototype.toObject = function (callback) {
        var self = this;

        // Check if callback is function
        if (typeof callback !== 'function') {
            throw new Error('Storage.localForage.toObject require a callback function');
        }

        // Result to return
        var result = {};

        try {

            // Create the prefix test
            var regex = new RegExp('^' + self.prefix());

            // Get keys, and iterate over them converting them back to an object, return the finished result.
            self.keys(function(keys, error) {
                var numKeys = keys.length,
                    keyIndex = 0;

                if(numKeys === 0) {
                    callback({}, null);
                    return;
                }
                else {
                    _.each(keys, function (nextKey) {
                        self.getItem(nextKey, function (item, error) {
                            keyIndex += 1;

                            try {
                                if (item && !error) {
                                    result[nextKey] = item;
                                }
                                else {
                                    console.log("LocalForage Driver Data error " + error + ": KEY(" + nextKey + ")");
                                }
                            } catch (err) {
                                console.log("LocalForage Driver Data exception " + err + ": KEY(" + nextKey + ")");
                            }

                            if (keyIndex === numKeys) {
                                callback(result, null);
                            }

                        });
                    });
                }
            });
        } catch (err) {

            // callback with error
            callback(null, err);

        }
    };

//////////////////////////////////////////////////////////////////////////////
// WRAP EVENTEMITTER API
//////////////////////////////////////////////////////////////////////////////

// Wrap the Event Emitter Api "on"
    Store.localForage.prototype.on = function (/* arguments */) {
        this.eventemitter.on.apply(this.eventemitter, _.toArray(arguments));
    };

// Wrap the Event Emitter Api "once"
    Store.localForage.prototype.once = function (/* arguments */) {
        this.eventemitter.once.apply(this.eventemitter, _.toArray(arguments));
    };

// Wrap the Event Emitter Api "off"
    Store.localForage.prototype.off = function (/* arguments */) {
        this.eventemitter.off.apply(this.eventemitter, _.toArray(arguments));
    };

// Wrap the Event Emitter Api "emit"
    Store.localForage.prototype.emit = function (/* arguments */) {
        this.eventemitter.emit.apply(this.eventemitter, _.toArray(arguments));
    };


// Add api helpers
    Store.localForage.prototype.addListener = Store.localForage.prototype.on;
    Store.localForage.prototype.removeListener = Store.localForage.prototype.off;
    Store.localForage.prototype.removeAllListeners = Store.localForage.prototype.off;

// Add jquery like helpers
    Store.localForage.prototype.one = Store.localForage.prototype.once;
    Store.localForage.prototype.trigger = Store.localForage.prototype.emit;


//////////////////////////////////////////////////////////////////////////////
// WRAP LOCALForage EVENTHANDLER
//////////////////////////////////////////////////////////////////////////////

// This will be a quick test to see if we have any relations to the data
    var _prefixedByUs = new RegExp('^' + _prefix(''));

// Add event handlers
    if (typeof window.addEventListener !== 'undefined') {
        // Add support for multiple tabs
        window.addEventListener('storage', function (e) {
            // Data changed in another tab, it would have updated localstorage, I'm
            // outdated so reload the tab and localstorage - but we test the prefix on the
            // key - since we actually make writes in the localstorage feature test

            // First of lets make sure that it was actually prefixed by us
            if (e.key && _prefixedByUs.test(e.key)) {

                // Okay, this looks familiar, now we try to lookup the storage instance
                // to emit an event on...

                // Remove the prefix
                var noPrefix = e.key.replace(_prefixedByUs, '');

                // So we know that the name dont contain suffix ".db."
                var elements = noPrefix.split('.db.');

                var storageName = elements.shift();

                // Get the remaining key
                var key = elements.join('.db.');

                // Get the affected storage
                var ForageAdapter = _localForageNS[storageName];

                if (ForageAdapter) {

                    // Emit the event on the storage
                    ForageAdapter.emit('storage', {
                        key:         key,
                        newValue:    e.newValue && EJSON.parse(e.newValue) || e.newValue,
                        oldValue:    e.oldValue && EJSON.parse(e.oldValue) || e.oldValue,
                        originalKey: e.key,
                        updatedAt:   new Date(e.timeStamp),
                        url:         e.url,
                        storage:     ForageAdapter
                    });
                }

            }

        }, false);
    }

}
