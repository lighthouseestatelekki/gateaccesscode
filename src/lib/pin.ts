export function isWeakPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return false;

  // All the same digit (e.g. 000000, 111111)
  if (new Set(pin).size === 1) return true;

  // Repeated pair pattern (e.g. 121212, 909090)
  if (pin.slice(0, 2).repeat(3) === pin) return true;

  // Straight sequence going up or down (e.g. 123456, 234567, 654321, 987654)
  const digits = pin.split("").map(Number);
  const goingUp = digits.every((d, i) => i === 0 || d - digits[i - 1]! === 1);
  const goingDown = digits.every((d, i) => i === 0 || d - digits[i - 1]! === -1);
  if (goingUp || goingDown) return true;

  return false;
}
