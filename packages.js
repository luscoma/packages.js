/*
    Alex Lusco
    MIT License

    Javascript implementation of tracking number validation for
    USPS, UPS, FedEx Ground, FedEx Express

    [Sources]
    http://answers.google.com/answers/threadview/id/207899.html
    http://www.codeproject.com/KB/recipes/Generate_UPS_Check_Digit.aspx
    http://images.fedex.com/us/solutions/ppe/FedEx_Ground_Label_Layout_Specification.pdf
    http://www.usps.com/cpim/ftp/pubs/pub91.pdf
    http://www.usps.com/cpim/ftp/pubs/pub109.pdf

    [Compatability]
    UPS: 100%, or at least should be
    FedEx: Validates fedex express, and should validate most fedex ground (the FedEx 96 style barcode), see notes for more details
    USPS: Should validate Certified, Insured, Registered, Return Receipt, and Delivery Confirm. See notes below.  Other methods probably won't
          validate as the service prefix will be different

    [NOTES]
    Fedex Ground and USPS are particularly challenging since they both employ the same barcode check scheme and use
    confusing prefix systems (unlike UPS which has the 1Z thing prefix for every code they have... talk about good idea).
    The difference between usps and fedex is the prefix.  Unfortunately its difficult to decode the prefixes correctly as the documents
    can be confusing.  Fedex states all fedex ground should start with 96 but there seems to be a confusing variant of it that 
    starts with 00 or others that just dont start with 96 at all. For now I am validating fedex ground as anything that starts
    with 96 or 00 and has the proper checkbit (though I think the 00 is unneeded).

    USPS is more complex as it it doesn't have a single prefix.  Different prefixes indicate different service types.  The ones
    I've found so far appear to be the common ones, but theres a solid chance I'm missing some since they are spread over a
    large number of documents.  Below are the prefixes being validated as usps assuming they have the proper checkbit.
    
    Certified Mail: 71, Insured Mail: 73, Registered Mail: 77, Return Receipt: 81, Delivery Confirm: 91, Zip+Delivery Confirm: 420. 
    
    TL;DR;  This is not an exhaustive list, particularly usps has too many prefixes that are not documented or documented in various places to figure out.  
            Also complicating matters is that fedex and usps use the same check digit scheme.
*/

// Namespace Declaration
TrackPkg = {}

// Trim Function We Need
if(typeof String.prototype.trim !== 'function') {
  String.prototype.trim = function() {
    return this.replace(/^\s+|\s+$/g, ''); 
  }
}

// Function Namespace
(function () {
    /*
    Validates a UPS tracking number
    return true if valid
    */
    function _validUPS(number) {
        number = number.trim();
        if (number.length != 18) { return false; }
        var check = number.substr(17, 1);

        // First Two Digits Must Be 1Z
        if (number.substr(0, 2) !== "1Z") { return false; }

        // Remaining Characters To Check
        number = number.substr(2, 15);
        console.log(number);

        var iRunningTotal = 0;
        var ValidChars = "0123456789";  // used to validate a number
        for (var i = 0; i < number.length; i++) {
            var c = number.charAt(i);
            if (((i + 1) % 2) == 0) { // even index value
                if (ValidChars.indexOf(c) != -1) // indicates numeric value
                    iRunningTotal += 2 * Number(c);
                else
                    iRunningTotal += (number.charCodeAt(i) - 63) % 10;

            }
            else {  // character is at an odd position
                if (ValidChars.indexOf(c) != -1) // indicates numeric value
                    iRunningTotal += Number(c);
                else {
                    var n = (number.charCodeAt(i) - 63) % 10;
                    iRunningTotal += (2 * n) - (9 * Math.floor(n / 5));
                }
            }
        }

        var digit = iRunningTotal % 10;
        if (digit != check && digit > 0)
            digit = 10 - digit;
        else
            return true;

        return digit == check
    }
    /*
        Validates a FedEx Expression Number
        These numbers are 12 digits
        return true
    */
    function _validFedexExpress(number) {
        number = number.trim();
        if (number.length != 12)
            return false;

        var values = [3, 1, 7];                           // the values to use when multiplying numbers
        var validnumbers = "0123456789";                // used to validate a number
        var total = 0;                                  // our current running total
        for (var i = 0; i < 11; i++) {
            var c = number.charAt(i);                   // character
            if (validnumbers.indexOf(c) == -1)               // if this isn't a number then its invalid
                return false;

            // Add the number to our running total
            var n = Number(c);
            total += n * values[i % 3];
        }

        // Calculate check digit
        var check = total % 11;
        if (check == 10)
            check = 0;

        return check == number[11];
    }
    /*
        Validates a Fedex Ground Tracking Number
        returns true if valid
    */
    function _validFedexGround(number) {
        // check the length (we only need 15 digits, the rest depend on the barcode type etc.)
        number = number.trim();
        valid_prefixes = ["96","00"]                                                    // valid prefixes for fedex ground (I'm a little unsure if 00 is necessary but it may be the code-128 barcodes start with 00 even they though encode a 96 barcode?)
        if (number.length < 15 || valid_prefixes.indexOf(number.substr(0,2)) === -1)    // 96 is the fedex ground application identifier
            return false;
        number = number.substr(number.length-15,15);         // the check digit is the most right information so we must handle that

        // Do the summing calculations
        var evenTotal = 0, oddTotal = 0;
        var validnumbers = "0123456789";                     // used to validate a number
        for (var i = 13; i >= 0; i--) {                       // algorithm works from right to left, so we have to deal with that
            var c = number.charAt(i)
            if (validnumbers.indexOf(c) == -1)
                return false;

            // Add the number to our running total
            if ((15-i) % 2 == 0)                // the 15-i accounts for the backwards way fedex treats its labels (The rightmost index is considered position 1)
                evenTotal += Number(c);
            else
                oddTotal += Number(c);
        }

        // We calculate the check digit
        var total = evenTotal*3 + oddTotal;
        var check = (10 - (total % 10));     // I am sure theres a better way to do this, but we just need to find the next highest multiple of 10 and substract
        return check == number[14]
    }
    /*
        Validates a USPS Tracking Number
        returs true if valid
    */
    function _validUSPS(number) {
        // check the length (we only need 22 didigts, the rest may depend on the barcode)
        number = number.trim();
        valid_prefix = ["91","71","73","77","81"];          // these are valid service prefixes for usps packages, this may not be an exhaustive list...
        if (number.length < 22 || valid_prefix.indexOf(number.substr(0,2)) === -1 || number.substr(0,3) == "420") // (420 is the ZIP+ barcode prefix)
            return false;
        number = number.substr(number.length-22,22);

        // Do the summing calculations
        var evenTotal = 0, oddTotal = 0;
        var validnumbers = "0123456789";                    // used to validate a number
        for (var i = 20; i >= 0; i--) {                     // algorithm works from right to left, so we have to deal with that
            var c = number.charAt(i)
            if (validnumbers.indexOf(c) == -1)
                return false;

            // Add the number to our running total
            if ((22-i) % 2 == 0)                            // fixes the backwards way usps does labels, right most digit is position 1.
                evenTotal += Number(c);
            else
                oddTotal += Number(c);
        }

        // We calculate the check digit
        var total = evenTotal*3 + oddTotal;
        var check = 10 - (total % 10);                      // the check digit is the difference between this value and the next multiple of 10

        return check == number[21]                          // if this check matches the checkdigit then we're good
    }

    /*
        Determines if a value is a tracking number
        returns "ups"|"fedex"|"usps" if valid, undefined if not
    */
    this.IsTrackingNumber = function(number) {
        if (_validUPS(number))
            return "ups";
        else if (_validFedexExpress(number) || _validFedexGround(number))
            return "fedex";
        else if (_validUSPS(number))
            return "usps";

        return undefined;
    }

    /*
        Returns the tracking URL if the tracking number
        is valid.  If it isn't will return undefined
    */
    this.GetTrackingURL = function(number) {
        var track = this.IsTrackingNumber(number);
        if (track == "ups")
            return "http://wwwapps.ups.com/tracking/tracking.cgi?tracknum=" + number;
        else if (track == "fedex")
            return "http://www.fedex.com/Tracking?tracknumbers=" + number;
        else if (track == "usps")
            return "http://trkcnfrm1.smi.usps.com/PTSInternetWeb/InterLabelInquiry.do?strOrigTrackNum=" + number;
        return undefined;
    }
}).call(TrackPkg);