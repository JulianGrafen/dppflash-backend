const GTIN_DIGITS_PATTERN = /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/;

export function isValidGtinDigits(value: string): boolean {
  if (!GTIN_DIGITS_PATTERN.test(value)) {
    return false;
  }

  const digits = value.split('').map(Number);
  const check = digits.pop();
  if (check === undefined) {
    return false;
  }

  const sum = digits
    .reverse()
    .reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 3 : 1), 0);

  return check === (10 - (sum % 10)) % 10;
}
