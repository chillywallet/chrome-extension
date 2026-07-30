const EMOJIS = [
    '🐵',
    '🐒',
    '🦍',
    '🦧',
    '🐶',
    '🐕',
    '🦮',
    '🐕‍🦺',
    '🐩',
    '🐺',
    '🦊',
    '🦝',
    '🐱',
    '🐈',
    '🐈‍⬛',
    '🦁',
    '🐯',
    '🐅',
    '🐆',
    '🐴',
    '🐎',
    '🦄',
    '🦓',
    '🦌',
    '🦬',
    '🐮',
    '🐂',
    '🐃',
    '🐄',
    '🐷',
    '🐖',
    '🐗',
    '🐽',
    '🐏',
    '🐑',
    '🐐',
    '🐪',
    '🐫',
    '🦙',
    '🦒',
    '🐘',
    '🦣',
    '🦏',
    '🦛',
    '🐭',
    '🐁',
    '🐀',
    '🐹',
    '🐰',
    '🐇',
    '🐿',
    '🦫',
    '🦔',
    '🦇',
    '🐻',
    '🐨‍',
    '🐼',
    '🦥',
    '🦦',
    '🦨',
    '🦘',
    '🦡',
    '🐾',
    '🦃',
    '🐔',
    '🐓',
    '🐣',
    '🐤',
    '🐥',
    '🐦',
    '🐧',
    '🕊',
    '🦅',
    '🦆',
    '🦢',
    '🦉',
    '🦤',
    '🪶',
    '🦩',
    '🦚',
    '🦜',
    '🐸',
    '🐊',
    '🐢',
    '🦎',
    '🐍',
    '🐲',
    '🐉',
    '🦕',
    '🦖',
    '🐳',
    '🐋',
    '🐬',
    '🦭',
    '🐟',
    '🐠',
    '🐡',
    '🦈',
    '🐙',
    '🐚',
    '🪸',
    '🐌',
    '🦋',
    '🐛',
    '🐜',
    '🐝',
    '🪲',
    '🐞',
    '🦗',
    '🪳',
    '🕷',
    '🦂',
    '🦟',
    '🪰',
    '🪱',
    '🦠',
];

export const DEFAULT_EMOJI = '🦊';

const getRandomIndex = (str: string, maxValue: number) => {
    var hash = 0;

    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    return Math.abs(hash % maxValue);
};

export const getRandomAvatar = (str: string) => {
    const randomIndex = getRandomIndex(str ? str.toLowerCase() : '', EMOJIS.length);
    return EMOJIS[randomIndex];
};

export const getRandomColor = (str: string) => {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    var colour = '#';
    for (var i = 0; i < 3; i++) {
        var value = (hash >> (i * 8)) & 0xff;
        colour += ('00' + value.toString(16)).substr(-2);
    }
    return colour;
};
