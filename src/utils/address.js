"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.areAddressStringsEqual = exports.formatAddressSummary = exports.serializeAddress = exports.hasAddressInformation = exports.addressPartsAreEqual = exports.parseAddress = exports.sanitizeAddressParts = exports.formatZipCode = exports.emptyAddressParts = void 0;
exports.emptyAddressParts = {
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
};
var sanitizeState = function (value) { return value.trim().toUpperCase().slice(0, 2); };
var sanitizeZip = function (value) { return value.replace(/\D/g, '').slice(0, 8); };
var formatZipCode = function (value) {
    var digits = sanitizeZip(value);
    if (digits.length <= 5)
        return digits;
    return "".concat(digits.slice(0, 5), "-").concat(digits.slice(5));
};
exports.formatZipCode = formatZipCode;
var sanitizeAddressParts = function (parts) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    var merged = __assign(__assign({}, exports.emptyAddressParts), (parts !== null && parts !== void 0 ? parts : {}));
    return {
        street: (_b = (_a = merged.street) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '',
        number: (_d = (_c = merged.number) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : '',
        complement: (_f = (_e = merged.complement) === null || _e === void 0 ? void 0 : _e.trim()) !== null && _f !== void 0 ? _f : '',
        neighborhood: (_h = (_g = merged.neighborhood) === null || _g === void 0 ? void 0 : _g.trim()) !== null && _h !== void 0 ? _h : '',
        city: (_k = (_j = merged.city) === null || _j === void 0 ? void 0 : _j.trim()) !== null && _k !== void 0 ? _k : '',
        state: sanitizeState((_l = merged.state) !== null && _l !== void 0 ? _l : ''),
        zipCode: sanitizeZip((_m = merged.zipCode) !== null && _m !== void 0 ? _m : ''),
    };
};
exports.sanitizeAddressParts = sanitizeAddressParts;
var parseAddress = function (value) {
    if (!value) {
        return __assign({}, exports.emptyAddressParts);
    }
    try {
        var parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') {
            return (0, exports.sanitizeAddressParts)(parsed);
        }
    }
    catch (error) {
        // ignore JSON parse errors – fallback below
    }
    var fallback = value.toString();
    if (!fallback) {
        return __assign({}, exports.emptyAddressParts);
    }
    // Attempt to parse legacy formatted string, e.g., "Rua X, 123 - Bairro Y, Cidade - ST, CEP 12345-678"
    var address = {};
    var cepMatch = fallback.match(/CEP\s*([\d-]+)/i);
    if (cepMatch) {
        address.zipCode = sanitizeZip(cepMatch[1]);
    }
    var clean = fallback.replace(/CEP\s*[\d-]+/i, '').trim();
    if (clean.endsWith(',')) {
        clean = clean.slice(0, -1);
    }
    var segments = clean.split(',').map(function (segment) { return segment.trim(); }).filter(Boolean);
    if (segments.length > 0) {
        address.street = segments[0];
    }
    if (segments.length > 1) {
        var numberNeighborhood = segments[1];
        var _a = numberNeighborhood.split('-').map(function (part) { return part.trim(); }), numberPart = _a[0], neighborhoodPart = _a[1];
        if (numberPart && !address.number) {
            address.number = numberPart;
        }
        if (neighborhoodPart && !address.neighborhood) {
            address.neighborhood = neighborhoodPart;
        }
    }
    if (segments.length > 2) {
        var cityState = segments[2];
        var _b = cityState.split('-').map(function (part) { return part.trim(); }), cityPart = _b[0], statePart = _b[1];
        if (cityPart && !address.city) {
            address.city = cityPart;
        }
        if (statePart && !address.state) {
            address.state = statePart;
        }
    }
    if (segments.length > 3) {
        address.complement = segments[3];
    }
    return (0, exports.sanitizeAddressParts)(address);
};
exports.parseAddress = parseAddress;
var addressPartsAreEqual = function (a, b) {
    var cleanA = (0, exports.sanitizeAddressParts)(a !== null && a !== void 0 ? a : exports.emptyAddressParts);
    var cleanB = (0, exports.sanitizeAddressParts)(b !== null && b !== void 0 ? b : exports.emptyAddressParts);
    return (cleanA.street === cleanB.street &&
        cleanA.number === cleanB.number &&
        cleanA.complement === cleanB.complement &&
        cleanA.neighborhood === cleanB.neighborhood &&
        cleanA.city === cleanB.city &&
        cleanA.state === cleanB.state &&
        cleanA.zipCode === cleanB.zipCode);
};
exports.addressPartsAreEqual = addressPartsAreEqual;
var hasAddressInformation = function (parts) {
    var clean = (0, exports.sanitizeAddressParts)(parts);
    return !!(clean.street ||
        clean.number ||
        clean.complement ||
        clean.neighborhood ||
        clean.city ||
        clean.state ||
        clean.zipCode);
};
exports.hasAddressInformation = hasAddressInformation;
var serializeAddress = function (parts) {
    var clean = (0, exports.sanitizeAddressParts)(parts);
    return JSON.stringify(clean);
};
exports.serializeAddress = serializeAddress;
var formatAddressSummary = function (parts) {
    if (!parts)
        return '';
    var clean = (0, exports.sanitizeAddressParts)(parts);
    var pieces = [];
    var streetLine = [clean.street, clean.number].filter(Boolean).join(', ');
    if (streetLine)
        pieces.push(streetLine);
    if (clean.complement)
        pieces.push(clean.complement);
    if (clean.neighborhood)
        pieces.push(clean.neighborhood);
    var cityState = [clean.city, clean.state].filter(Boolean).join(' - ');
    if (cityState)
        pieces.push(cityState);
    if (clean.zipCode)
        pieces.push("CEP ".concat((0, exports.formatZipCode)(clean.zipCode)));
    return pieces.join(', ');
};
exports.formatAddressSummary = formatAddressSummary;
var areAddressStringsEqual = function (a, b) {
    return (0, exports.addressPartsAreEqual)((0, exports.parseAddress)(a), (0, exports.parseAddress)(b));
};
exports.areAddressStringsEqual = areAddressStringsEqual;
