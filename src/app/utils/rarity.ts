export interface RarityInfo {
    label: string;
    colorClass: string;
    percent: number;
}

export function calculateRarity(percent: number): RarityInfo {
    const rounded = Math.round(percent);
    if (percent < 1) return { label: 'Legendary', colorClass: 'legendary', percent: rounded }; // 0% is Legendary
    if (percent < 5) return { label: 'Epic', colorClass: 'epic', percent: rounded };
    if (percent < 15) return { label: 'Rare', colorClass: 'rare', percent: rounded };
    if (percent < 30) return { label: 'Uncommon', colorClass: 'uncommon', percent: rounded };
    return { label: 'Common', colorClass: 'common', percent: rounded };
}
