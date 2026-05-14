/**
 * CORE: NARZĘDZIA MATEMATYCZNE (MathUtils)
 * Funkcje pomocnicze do obliczeń wektorowych i geometrycznych.
 */

export function distanceBetween(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}
