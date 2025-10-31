export interface AddressParts {
	street: string;
	number: string;
	complement: string;
	neighborhood: string;
	city: string;
	state: string;
	zipCode: string;
}

export const emptyAddressParts: AddressParts = {
	street: '',
	number: '',
	complement: '',
	neighborhood: '',
	city: '',
	state: '',
	zipCode: '',
};

const sanitizeState = (value: string): string => value.trim().toUpperCase().slice(0, 2);

const sanitizeZip = (value: string): string => value.replace(/\D/g, '').slice(0, 8);

export const formatZipCode = (value: string): string => {
	const digits = sanitizeZip(value);
	if (digits.length <= 5) return digits;
	return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export const sanitizeAddressParts = (parts: Partial<AddressParts> | undefined | null): AddressParts => {
	const merged = { ...emptyAddressParts, ...(parts ?? {}) };
	return {
		street: merged.street?.trim() ?? '',
		number: merged.number?.trim() ?? '',
		complement: merged.complement?.trim() ?? '',
		neighborhood: merged.neighborhood?.trim() ?? '',
		city: merged.city?.trim() ?? '',
		state: sanitizeState(merged.state ?? ''),
		zipCode: sanitizeZip(merged.zipCode ?? ''),
	};
};

export const parseAddress = (value?: string | null): AddressParts => {
	if (!value) {
		return { ...emptyAddressParts };
	}

	try {
		const parsed = JSON.parse(value);
		if (parsed && typeof parsed === 'object') {
			return sanitizeAddressParts(parsed as Partial<AddressParts>);
		}
	} catch (error) {
		// ignore JSON parse errors – fallback below
	}

	const fallback = value.toString();
	if (!fallback) {
		return { ...emptyAddressParts };
	}

	// Attempt to parse legacy formatted string, e.g., "Rua X, 123 - Bairro Y, Cidade - ST, CEP 12345-678"
	const address: Partial<AddressParts> = {};

	const cepMatch = fallback.match(/CEP\s*([\d-]+)/i);
	if (cepMatch) {
		address.zipCode = sanitizeZip(cepMatch[1]);
	}

	let clean = fallback.replace(/CEP\s*[\d-]+/i, '').trim();
	if (clean.endsWith(',')) {
		clean = clean.slice(0, -1);
	}

	const segments = clean.split(',').map((segment) => segment.trim()).filter(Boolean);

	if (segments.length > 0) {
		address.street = segments[0];
	}

	if (segments.length > 1) {
		const numberNeighborhood = segments[1];
		const [numberPart, neighborhoodPart] = numberNeighborhood.split('-').map((part) => part.trim());
		if (numberPart && !address.number) {
			address.number = numberPart;
		}
		if (neighborhoodPart && !address.neighborhood) {
			address.neighborhood = neighborhoodPart;
		}
	}

	if (segments.length > 2) {
		const cityState = segments[2];
		const [cityPart, statePart] = cityState.split('-').map((part) => part.trim());
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

	return sanitizeAddressParts(address);
};

export const addressPartsAreEqual = (a?: AddressParts | null, b?: AddressParts | null): boolean => {
	const cleanA = sanitizeAddressParts(a ?? emptyAddressParts);
	const cleanB = sanitizeAddressParts(b ?? emptyAddressParts);

	return (
		cleanA.street === cleanB.street &&
		cleanA.number === cleanB.number &&
		cleanA.complement === cleanB.complement &&
		cleanA.neighborhood === cleanB.neighborhood &&
		cleanA.city === cleanB.city &&
		cleanA.state === cleanB.state &&
		cleanA.zipCode === cleanB.zipCode
	);
};

export const hasAddressInformation = (parts: AddressParts): boolean => {
	const clean = sanitizeAddressParts(parts);
	return !!(
		clean.street ||
		clean.number ||
		clean.complement ||
		clean.neighborhood ||
		clean.city ||
		clean.state ||
		clean.zipCode
	);
};

export const serializeAddress = (parts: AddressParts): string => {
	const clean = sanitizeAddressParts(parts);
	return JSON.stringify(clean);
};

export const formatAddressSummary = (parts: AddressParts | undefined | null): string => {
	if (!parts) return '';
	const clean = sanitizeAddressParts(parts);

	const pieces: string[] = [];

	const streetLine = [clean.street, clean.number].filter(Boolean).join(', ');
	if (streetLine) pieces.push(streetLine);

	if (clean.complement) pieces.push(clean.complement);
	if (clean.neighborhood) pieces.push(clean.neighborhood);

	const cityState = [clean.city, clean.state].filter(Boolean).join(' - ');
	if (cityState) pieces.push(cityState);

	if (clean.zipCode) pieces.push(`CEP ${formatZipCode(clean.zipCode)}`);

	return pieces.join(', ');
};

export const areAddressStringsEqual = (a?: string | null, b?: string | null): boolean => {
	return addressPartsAreEqual(parseAddress(a), parseAddress(b));
};