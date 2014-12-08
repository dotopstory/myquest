define(['lib/stacktrace'], function(Stack){

	var GenericError = function(error, data) {
		this.name    = "Error";
		this.message = error;
		this.data    = (data || null);
		this.print   = function() {
			if (console.error) {
				console.error(this.name + ': ' + this.message);
				if (this.data) console.error(data);
				console.trace();
				console.log(this.stack);
			} else {
				console.log(this.name + ': ' + this.message);
				console.log(this.stack);
				if (this.data) console.log(data);
			}
		}
	};
	GenericError.prototype = new Error;

	var errorTypes = [
		'MismatchError',
		'RangeError',
		'UnexpectedError'
	], allErrors = {};

	allErrors['GenericError'] = GenericError;

	for (var i=0; i<errorTypes.length; ++i) {
		var errorName = errorTypes[i];
		allErrors[errorName] = function(error) {
			this.name = errorName;
			this.message = error;
		};
		allErrors[errorName].prototype = new GenericError;

	}

	return allErrors;
});
